import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CreateWebsiteAgentDto } from './dto/create-website-agent.dto';
import { S3Service } from 'src/aws/s3/s3.service';
import { AiModelsService } from 'src/ai-models/ai-models.service';
import { ModelType } from 'src/ai-models/strategies/strategy-factory';
import { AgentType, Prisma } from '@prisma/client';
import { AgentRepository } from './agent.repository';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EmbeddingRepository } from 'src/embeddings/embedding.repository';
import { IngestionService } from 'src/ingestion/ingestion.service';
import { DatabaseService } from 'src/database/database.service';

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
    private readonly ingestionService: IngestionService,
    private readonly agentRepository: AgentRepository,
    private readonly embeddingRepository: EmbeddingRepository,
    private readonly databaseService: DatabaseService,
  ) {}
  logger = new Logger(WebAgentsService.name);

  createOrUpdateFromMultipartFormData(
    formData: any,
    files: Express.Multer.File[],
    orgId: string,
    agentId?: string,
  ) {
    // Validate required fields
    this.validateRequiredFields(formData);

    // Parse the form data and construct the DTO
    const createWebsiteAgentDto = new CreateWebsiteAgentDto();

    // Extract text fields
    createWebsiteAgentDto.agentName = formData.agentName as string;
    createWebsiteAgentDto.persona = formData.persona as string;
    createWebsiteAgentDto.type = formData['knowledgeBase.type'];

    // Extract knowledge base data
    createWebsiteAgentDto.knowledgeBase = {
      type: formData['knowledgeBase.type'],
      freeText: formData['knowledgeBase.freeText'] as string,
      links: createWebsiteAgentDto.knowledgeBase.links,
      documents: [],
    };

    // Process uploaded files
    if (createWebsiteAgentDto.type === 'documents') {
      const documents = files.filter(
        file => file.fieldname === 'knowledgeBase.documents',
      );
      if (documents.length > 0) {
        createWebsiteAgentDto.knowledgeBase.documents = documents;
      }
    }
    if (files && files.length > 0) {
      const avatar = files.find(file => file.fieldname === 'avatar');
      if (avatar) {
        createWebsiteAgentDto.avatar = avatar;
      }
    }
    if (!agentId) {
      return this.create(createWebsiteAgentDto, orgId);
    }

    return this.updateWebsiteAgent(agentId, createWebsiteAgentDto, orgId);
  }

  async create(data: CreateWebsiteAgentDto, orgId: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.aiModelService.switchStrategy(ModelType.OLLAMA);
    }
    let s3Url: string | null = null;

    // Upload avatar to s3, get the link
    if (data.avatar) {
      s3Url = await this.s3Service.uploadFile(
        data.avatar,
        orgId,
        `${orgId}/avatar/`,
      );
    }

    // TODO: wrap this in a transaction so we can revert
    const agentPayload: Prisma.AgentsCreateInput = {
      name: data.agentName,
      type: AgentType.website,
      avatar: s3Url,
      organization: {
        connect: {
          id: orgId,
        },
      },
      persona: data.persona,
    };

    if (data.type === 'links' && data.knowledgeBase.links) {
      agentPayload.links = {
        createMany: {
          data: data.knowledgeBase.links.map(link => ({
            link: link.link,
            isSPA: link.isSpa,
          })),
        },
      };
    }

    const agent = await this.agentRepository.create(agentPayload);

    if (data.type === 'documents') {
      if (data.knowledgeBase.documents) {
        const documentUrls =
          await this.ingestionService.processDocumentIngestion(
            data,
            orgId,
            agent,
          );
        console.log('documentUrls', documentUrls);
      } else {
        throw new BadRequestException('No documents provided');
      }
    }

    if (data.type === 'plaintext') {
      if (data.knowledgeBase.freeText) {
        await this.ingestionService.processPlainTextIngestion(
          data,
          orgId,
          agent,
        );
      } else {
        throw new BadRequestException('No knowledge base provided');
      }
    }

    if (data.type === 'links') {
      if (data.knowledgeBase.links) {
        const links = data.knowledgeBase.links;
        try {
          await this.ingestionService.processLinksIngestion(
            links,
            orgId,
            agent,
          );
        } catch (e) {
          console.log('Error:', e);
          throw new HttpException(
            'Provided link is not a valid URL',
            HttpStatus.BAD_REQUEST,
          );
        }
      } else {
        throw new BadRequestException('No links provided');
      }
    }

    return {
      message: 'Agent created successfully',
      data: agent,
    };
  }

  /**
   * 1. Update agent in db/s3
   * 2. Update ingestion in n8n
   * 3. IF n8n is successful, delete old embedding data and create new embedding in n8n
   * 4. firestore for frontend to let the user know that the agent is ready
   *
   * @param id
   * @param data
   * @param orgId
   */
  async updateWebsiteAgent(
    id: string,
    data: CreateWebsiteAgentDto,
    orgId: string,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      this.aiModelService.switchStrategy(ModelType.OLLAMA);
    }

    const agent = await this.agentRepository.findById(id, orgId);
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }
    const embeddingsToReplace = await this.embeddingRepository
      .findByAgentId(agent.id)
      .then(embedding => embedding.id);

    let s3Url: string | null = null;
    if (data.avatar) {
      s3Url = await this.s3Service.uploadFile(
        data.avatar,
        orgId,
        `${orgId}/avatar/`,
      );
    }

    await this.databaseService.$transaction(async tx => {
      tx.agents.update({
        data: {
          name: data.agentName,
          persona: data.persona,
          avatar: s3Url ? s3Url : agent.avatar,
        },
        where: {
          id: id,
        },
      });

      tx.agentWebLinks.deleteMany({
        where: { agentId: id },
      });

      if (data.type === 'links' && data.knowledgeBase.links) {
        tx.agentWebLinks.createMany({
          data: data.knowledgeBase.links.map(link => ({
            link: link.link,
            isSPA: link.isSpa,
            agentId: id,
          })),
        });
        await this.ingestionService.processLinksIngestion(
          data.knowledgeBase.links,
          orgId,
          agent,
          embeddingsToReplace,
        );
      }

      if (data.type === 'documents') {
        if (data.knowledgeBase.documents) {
          const documentUrls =
            await this.ingestionService.processDocumentIngestion(
              data,
              orgId,
              agent,
              embeddingsToReplace,
            );
          console.log('documentUrls', documentUrls);
        } else {
          throw new BadRequestException('No documents provided');
        }
      }

      if (data.type === 'plaintext') {
        if (data.knowledgeBase.freeText) {
          await this.ingestionService.processPlainTextIngestion(
            data,
            orgId,
            agent,
            embeddingsToReplace,
          );
        } else {
          throw new BadRequestException('No knowledge base provided');
        }
      }

      return {
        message: 'Agent update triggered',
        data: agent,
      };
    });
  }

  async deleteAgent(id: string, orgId: string) {
    const success = await this.agentRepository.deleteById(id, orgId);

    if (!success) {
      throw new BadRequestException('Failed to delete agent');
    }

    return {
      message: 'Agent deleted successfully',
      data: success,
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

    const content = embedding.map(e => e.text).join('\n');

    return {
      ...agent,
      freeText: content,
    };
  }

  private validateRequiredFields(formData: any): void {
    if (!formData.agentName || typeof formData.agentName !== 'string') {
      throw new BadRequestException(
        'agentName is required and must be a string',
      );
    }

    if (!formData.persona || typeof formData.persona !== 'string') {
      throw new BadRequestException('persona is required and must be a string');
    }
  }
}
