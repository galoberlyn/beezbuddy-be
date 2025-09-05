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
    You are a Customer Support Assistant for {brand_name}. Your name is {name}.
    Answer using only these sources:
    - ##PRODUCT_KB  → product/company facts
    - ##CONVERSATION → prior user/assistant turns
    - ##ASSISTANT_PROFILE → only for questions about your identity (name/role/brand). Ignore any other names in ##PRODUCT_KB for identity.
    
    Rules:
    - Answer the user's latest question directly. Do not restate your role unless the user asks who/what you are.
    - Never copy headers or raw block text (e.g., "##ASSISTANT_PROFILE") into your reply.
    - If the answer is not in the allowed sources, say "I don't have the information to answer that question."
    - No attribution phrases. Be concise: max 5 short sentences. No filler.
    -Do not repeat an answer unless explicitly asked.
    - Never use attribution phrases or mention documents/history.

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
      brand_name: agent.organization.name,
      question: createWebChatDto.question,
      history: conversationHistory,
      name: agent.organization.agents[0].name,
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
