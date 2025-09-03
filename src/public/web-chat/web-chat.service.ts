import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { CreateWebChatDto } from './dto/create-web-chat.dto';
import { AgentRepository } from 'src/agents/agent.repository';
import { Request } from 'express';
import { ModelType } from 'src/ai-models/strategies/strategy-factory';
import { AiModelsService } from 'src/ai-models/ai-models.service';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { PublicConversationsRepository } from '../conversations/public-conversations.repository';

@Injectable()
export class WebChatService {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly aiModelService: AiModelsService,
    private readonly publicConvoRepo: PublicConversationsRepository,
  ) {}

  async create(
    agentId: string,
    orgId: string,
    sessionId: string,
    createWebChatDto: CreateWebChatDto,
    req: Request,
  ) {
    const agent: any = await this.agentRepository.findById(agentId, orgId);
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const host = req.get('host');
    if (!host) {
      throw new BadRequestException('Host not found');
    }
    const domain = host.split(':')[0];

    const isAuthorized = agent.authorizedDomains.some(
      authorizedDomain => authorizedDomain.domain === domain,
    );

    if (!isAuthorized && process.env.NODE_ENV == 'production') {
      throw new UnauthorizedException('Unauthorized domain');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('Switching to OLLAMA');
      this.aiModelService.switchStrategy(ModelType.OLLAMA);
    }

    const vectorStore = this.aiModelService.getVectorStore();
    const retriever = vectorStore.asRetriever({
      k: 4,
      filter: {
        organizationId: orgId,
        agentId: agentId,
      },
    });

    const retrievedDocs = await retriever.invoke(createWebChatDto.question);
    const llmContext = retrievedDocs
      .map(
        (d, i) =>
          `# Doc ${i + 1}\n${d.pageContent}\nMETA: ${JSON.stringify(d.metadata)}`,
      )
      .join('\n\n');
    const conversationHistory = await this.getConversationHistory(
      sessionId,
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
      brand_name: agent.organization.name,
      question: createWebChatDto.question,
      history: conversationHistory,
    });

    return {
      message: 'Query successful',
      answer: answer,
    };
  }

  private async getConversationHistory(sessionId: string, agentId: string) {
    const conversationHistory = await this.publicConvoRepo.findBySessionId(
      sessionId,
      agentId,
    );

    if (!conversationHistory) {
      return '';
    }

    return conversationHistory
      .map(
        (c, index) =>
          `Conversation ${index + 1}:\nHuman: ${c.question}\nAssistant: ${c.answer}`,
      )
      .join('\n\n');
  }
}
