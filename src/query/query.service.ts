import { Injectable, Logger } from '@nestjs/common';
import { AiModelsService } from 'src/ai-models/ai-models.service';
import { ConversationRepository } from 'src/conversations/coversations.repository';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ModelType } from 'src/ai-models/strategies/strategy-factory';

@Injectable()
export class QueryService {
  logger = new Logger(QueryService.name);

  constructor(
    private readonly aiModelService: AiModelsService,
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async ask(question: string, organizationId: string, userId: string) {
    // Ensure strategy is set so vector store uses correct per-model table
    if (process.env.NODE_ENV !== 'production') {
      console.log('Switching to OLLAMA');
      this.aiModelService.switchStrategy(ModelType.OLLAMA);
    }
    const vectorStore = await this.aiModelService.getVectorStore();
    const retriever = vectorStore.asRetriever({
      k: 4,
      filter: {
        organization_id: organizationId,
      } as any,
    });
    console.log('Retrieving docs', question);
    const retrievedDocs = await retriever.invoke(question);
    console.log(retrievedDocs);

    const llmContext = retrievedDocs;

    const conversationHistory = await this.getConversationHistory(userId);
    console.log('Conversation history', conversationHistory);

    // TODO: prompt should come from database
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a knowledgeable and concise assistant. Answer questions using only the information provided in the context and conversation history.
    
    Guidelines:
    - Use only information from the provided context and prior conversation history.
    - If the answer is not in the context, clearly state that you cannot answer.
    - Do not mention the source of your answer; respond directly and confidently.
    - Avoid filler phrases or unnecessary wording.
    - If the user refers to earlier parts of the conversation, incorporate relevant details from the history.
    - Respond in the same language the user is using.
    - Keep answers brief, clear, and factual.
    - When asked about conversation history (like "What was my first question"), carefully examine the conversation history to provide accurate answers.
    - The conversation history is in chronological order, so the first entry is the earliest conversation.
    
    Context: {context}
    Conversation History: {history}`,
      ],
      ['human', 'Question: {question}'],
    ]);

    const llm = await this.aiModelService.getLanguageModel();

    const chain = RunnableSequence.from([
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    const answer = await chain.invoke({
      context: llmContext,
      history: conversationHistory,
      question,
    });

    await this.conversationRepository.create(userId, question, answer);

    return {
      message: 'Query successful',
      answer,
    };
  }

  private async getConversationHistory(userId: string) {
    const conversationHistory =
      await this.conversationRepository.findByUserId(userId);

    return conversationHistory
      .map(
        (c, index) =>
          `Conversation ${index + 1}:\nHuman: ${c.question}\nAssistant: ${c.answer}`,
      )
      .join('\n\n');
  }
}
