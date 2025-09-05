import { Injectable, Logger } from '@nestjs/common';
import { AiModelsService } from 'src/ai-models/ai-models.service';
import { ConversationsRepository } from 'src/conversations/coversations.repository';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ModelType } from 'src/ai-models/strategies/strategy-factory';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class QueryService {
  logger = new Logger(QueryService.name);

  constructor(
    private readonly aiModelService: AiModelsService,
    private readonly conversationRepository: ConversationsRepository,
    private readonly databaseService: DatabaseService,
  ) {}

  async askTest(
    question: string,
    organizationId: string,
    userId: string,
    agentId: string,
  ) {
    // Ensure strategy is set so vector store uses correct per-model table
    if (process.env.NODE_ENV !== 'production') {
      console.log('Switching to OLLAMA');
      this.aiModelService.switchStrategy(ModelType.OLLAMA);
    }
    const vectorStore = this.aiModelService.getVectorStore();
    const retriever = vectorStore.asRetriever({
      k: 4,
      filter: {
        organizationId,
        agentId,
      } as any,
    });

    const retrievedDocs = await retriever.invoke(question);
    const org = await this.databaseService.organization.findFirst({
      where: { id: organizationId },
      include: {
        agents: {
          where: {
            id: agentId,
          },
          select: {
            name: true,
          },
        },
      },
    });

    const llmContext = retrievedDocs
      .map(
        (d, i) =>
          `# Doc ${i + 1}\n${d.pageContent}\nMETA: ${JSON.stringify(d.metadata)}`,
      )
      .join('\n\n');

    const conversationHistory = await this.getConversationHistory(
      userId,
      agentId,
    );

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `
    You are a Customer Support Assistant for {brand_name}. Your name is {name}.
    Answer using only these sources:
    - ##PRODUCT_KB  → product/company facts
    - ##CONVERSATION → prior user/assistant turns
    - ##ASSISTANT_PROFILE → only for questions about your identity (name/role/brand). Ignore any other names in ##PRODUCT_KB for identity.
    
    Rules:
    1) Answer the user's latest question directly. Do not restate your role unless the user asks who/what you are.
    2) Never copy headers or raw block text (e.g., "##ASSISTANT_PROFILE") into your reply.
    3) If the answer is not in the allowed sources, say "I don't have the information to answer that question."
    4) No attribution phrases. Be concise: max 5 short sentences. No filler.
    5) If the user asks "Who developed you?" and it's not in ##PRODUCT_KB or ##CONVERSATION, say "I don't know."
    6) Do not repeat an answer unless explicitly asked.
    7) Never use attribution phrases or mention documents/history.

    ##ASSISTANT_PROFILE
    name: {name}
    role: Customer Support Assistant
    brand: {brand_name}
    
    ##PRODUCT_KB
    {context}
    
    ##CONVERSATION
    {history}
      `.trim(),
      ],
      ['human', 'Question: {question}'],
    ]);

    const llm = this.aiModelService.getLanguageModel();

    const chain = RunnableSequence.from([
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    const answer = await chain.invoke({
      context: llmContext,
      brand_name: org?.name,
      name: org?.agents[0].name,
      history: conversationHistory,
      question,
    });

    await this.conversationRepository.create(userId, question, answer, agentId);

    return {
      message: 'Query successful',
      answer,
    };
  }

  private async getConversationHistory(userId: string, agentId: string) {
    const conversationHistory = await this.conversationRepository.findByUserId(
      userId,
      agentId,
    );

    return conversationHistory
      .map(
        (c, index) =>
          `Conversation ${index + 1}:\nHuman: ${c.question}\nAssistant: ${c.answer}`,
      )
      .join('\n\n');
  }
}
