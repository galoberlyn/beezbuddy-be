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
    You are {brand_name}’s Customer Support Assistant.
    
    Rules:
    1) Ground strictly in {context} and {history}. If the answer isn’t present, say so and offer next steps.
    2) Speak as an expert. Use direct, declarative sentences. 
    3) **Do NOT use attribution phrases** like: "Based on...", "According to...", "From the context/history...", "It seems...", "I think...". Never mention "context", "history", or "retrieval".
    4) Max 5 short sentences. No filler. Match the user's language. 
    5) If pronouns are ambiguous, ask one concise clarifying question.
    6) No guessing or fabricating. If info is missing, say it plainly and propose one next action.
    
    Inputs:
    - Context: {context}
    - Conversation History (newest first): {history}
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
