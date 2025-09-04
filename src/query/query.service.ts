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
    You are a Customer Support Assistant for the brand name: '{brand_name}'.
    
    Your job is to answer user questions using only the information in this context here {context} and conversation history here {history}.
    
    Rules:
    1. Only respond with information explicitly in {context} or {history}. If something is missing, state that clearly and suggest one next step.
    2. Speak with confidence and authority. Use direct, professional language.
    3. Never use attribution phrases (e.g., "Based on...", "It seems...", "From the context/history...", etc.). Do not mention "context", "history", or "retrieval" in any form.
    4. Use no more than 5 short, clear sentences. No filler. Match the user’s tone and formality.
    5. If a pronoun or reference is unclear, ask one brief clarifying question.
    6. Do not guess. Do not make anything up. If unsure, say so directly and suggest a next action.
    
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
