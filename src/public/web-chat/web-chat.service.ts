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
