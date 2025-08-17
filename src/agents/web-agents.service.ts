import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CreateWebsiteAgentDto } from './dto/create-website-agent.dto';
import { S3Service } from 'src/aws/s3/s3.service';
import { AiModelsService } from 'src/ai-models/ai-models.service';
import { ModelType } from 'src/ai-models/strategies/strategy-factory';
import { LangchainService } from 'src/langchain/langchain.service';
import { AgentType } from '@prisma/client';
import { AgentRepository } from './agent.repository';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EmbeddingRepository } from 'src/embeddings/embedding.repository';

const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

@Injectable()
export class WebAgentsService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly aiModelService: AiModelsService,
    private readonly langchainService: LangchainService,
    private readonly agentRepository: AgentRepository,
    private readonly embeddingRepository: EmbeddingRepository,
  ) {}
  logger = new Logger(WebAgentsService.name);

  createFromMultipartFormData(
    formData: any,
    files: Express.Multer.File[],
    organization: string,
  ) {
    // Validate required fields
    this.validateRequiredFields(formData);

    // Parse the form data and construct the DTO
    const createWebsiteAgentDto = new CreateWebsiteAgentDto();

    // Extract text fields
    createWebsiteAgentDto.agentName = formData.agentName as string;
    createWebsiteAgentDto.persona = formData.persona as string;

    // Extract knowledge base data
    createWebsiteAgentDto.knowledgeBase = {
      freeText: formData['knowledgeBase.freeText'] as string,
      links: this.parseLinks(formData),
      documents: [],
    };

    // Process uploaded files
    if (files && files.length > 0) {
      const avatar = files.find(file => file.fieldname === 'avatar');
      const documents = files.filter(
        file => file.fieldname === 'knowledgeBase.documents',
      );

      if (avatar) {
        createWebsiteAgentDto.avatar = avatar;
      }
      if (documents.length > 0) {
        createWebsiteAgentDto.knowledgeBase.documents = documents;
      }
    }
    return this.create(createWebsiteAgentDto, organization);
  }

  async create(data: CreateWebsiteAgentDto, organization: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.aiModelService.switchStrategy(ModelType.OLLAMA);
    }
    const vectorStore = await this.aiModelService.getVectorStore();
    let s3Url: string | null = null;
    const documentUrls: string[] = [];

    // Upload avatar to s3, get the link
    if (data.avatar) {
      if (process.env.NODE_ENV !== 'production') {
        s3Url =
          'https://beezbuddystorage.s3.amazonaws.com/ad2bff82-8cf5-4b52-ab5d-28d784d5ad84/ad2bff82-8cf5-4b52-ab5d-28d784d5ad84/avatar/sign2.png';
      } else {
        s3Url = await this.s3Service.uploadFile(
          data.avatar,
          organization,
          `${organization}/avatar/`,
        );
      }
    }

    // TODO: wrap this in a transaction so we can revert
    const agent = await this.agentRepository.create({
      name: data.agentName,
      type: AgentType.website,
      avatar: s3Url,
      organization: {
        connect: {
          id: organization,
        },
      },
      persona: data.persona,
    });

    /**
     * TODO support only pdf/txt/doc/excel?
     */
    if (data.knowledgeBase.documents) {
      const documentUploads = await Promise.all(
        data.knowledgeBase.documents.map((document: Express.Multer.File) =>
          this.s3Service.uploadFile(
            document,
            organization,
            `${organization}/documents/`,
          ),
        ),
      );
      if (documentUploads) {
        documentUrls.push(...documentUploads);
      }
    }

    if (data.knowledgeBase.freeText) {
      try {
        const freeTextDocs = await this.langchainService.textToDocs(
          data.knowledgeBase.freeText,
          organization,
          agent.id,
        );

        await vectorStore.addDocuments(freeTextDocs, {
          ids: freeTextDocs.map(doc => doc.metadata.id),
        });
      } catch (error) {
        this.logger.error('Failed to add documents to vector store:', error);
        throw error;
      }
    }

    return {
      message: 'Agent created successfully',
      data: agent,
    };
  }

  async getWebsiteAgents(orgId: string) {
    const webAgents = await this.agentRepository.findAllByOrgId(orgId);

    // Process all agents to get signed avatar URLs
    const agentsWithAvatars = await Promise.all(
      webAgents.map(async agent => {
        if (!agent.avatar) {
          return agent;
        }

        try {
          const command = new GetObjectCommand({
            Bucket: 'beezbuddystorage',
            Key: `${orgId}/avatar/sign2.png`,
          });

          const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 3600 * 2, // 2 hours
          });

          return {
            ...agent,
            avatar: signedUrl,
          };
        } catch (error) {
          this.logger.error(
            `Failed to get signed URL for avatar of agent ${agent.id}:`,
            error,
          );
          // Return agent with original avatar URL if signing fails
          return agent;
        }
      }),
    );

    return agentsWithAvatars;
  }

  async getWebsiteAgent(id: string, orgId: string) {
    const agent = await this.agentRepository.findById(id, orgId);

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    const embedding = await this.embeddingRepository.findByAgentId(agent?.id);

    const content = embedding.map(e => e.content).join('\n');

    return {
      ...agent,
      freeText: content,
    };
  }

  // updateWebsiteAgent(id: string, body: any, orgId: string) {}

  private validateRequiredFields(formData: any): void {
    if (!formData.agentName || typeof formData.agentName !== 'string') {
      throw new BadRequestException(
        'agentName is required and must be a string',
      );
    }

    if (!formData.persona || typeof formData.persona !== 'string') {
      throw new BadRequestException('persona is required and must be a string');
    }

    if (
      !formData['knowledgeBase.freeText'] ||
      typeof formData['knowledgeBase.freeText'] !== 'string'
    ) {
      throw new BadRequestException(
        'knowledgeBase.freeText is required and must be a string',
      );
    }
  }

  private parseLinks(formData: any): string[] {
    const links: string[] = [];
    const linkKeys = Object.keys(formData).filter(key =>
      key.startsWith('knowledgeBase.links['),
    );

    linkKeys.forEach(key => {
      const match = key.match(/knowledgeBase\.links\[(\d+)\]\.url/);
      if (match) {
        const index = parseInt(match[1]);
        const url = formData[key] as string;
        if (url && typeof url === 'string') {
          links[index] = url;
        }
      }
    });

    return links.filter(link => link);
  }
}
