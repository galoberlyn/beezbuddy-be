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
import { Agents, AgentType, Prisma } from '@prisma/client';
import { AgentRepository } from './agent.repository';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EmbeddingRepository } from 'src/embeddings/embedding.repository';
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
    this.validateRequiredFields(formData);

    const createWebsiteAgentDto = new CreateWebsiteAgentDto();

    createWebsiteAgentDto.agentName = formData.agentName;
    createWebsiteAgentDto.agentDescription = formData.agentDescription;
    createWebsiteAgentDto.persona = formData.persona;

    if (formData['authorizedDomains']) {
      createWebsiteAgentDto.authorizedDomains = JSON.parse(
        formData['authorizedDomains'],
      );
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
    let s3Url: string | null = null;

    // Upload avatar to s3, get the link
    if (data.avatar) {
      s3Url = await this.s3Service.uploadFile(data.avatar, orgId, `/avatar/`);
    }

    const agentPayload: Prisma.AgentsCreateInput = {
      name: data.agentName,
      type: AgentType.website,
      description: data.agentDescription,
      avatar: s3Url,
      organization: {
        connect: {
          id: orgId,
        },
      },
      persona: data.persona,
      authorizedDomains: {
        createMany: {
          data: data.authorizedDomains?.map(domain => ({
            domain: domain.url,
          })),
        },
      },
    };

    try {
      let agent: Agents | null = null;
      await this.databaseService.$transaction(async tx => {
        agent = await this.agentRepository.create(agentPayload, tx);
      });

      return {
        message: 'Agent created successfully',
        data: agent,
      };
    } catch (error) {
      this.logger.error(
        'Failed to create an agent, something went wrong',
        error,
      );
      throw new HttpException(
        'Failed to create an agent, something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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

    let s3Url: string | null = null;
    if (data.avatar) {
      s3Url = await this.s3Service.uploadFile(
        data.avatar,
        orgId,
        `${orgId}/avatar/`,
      );
    }

    await this.databaseService.$transaction(async tx => {
      await tx.agents.update({
        data: {
          name: data.agentName,
          persona: data.persona,
          description: data.agentDescription,
          avatar: s3Url ? s3Url : agent.avatar,
        },
        where: {
          id: id,
        },
      });

      return {
        message: 'Agent update triggered',
        data: agent,
      };
    });
  }

  async deleteAgent(id: string, orgId: string) {
    const success = await this.agentRepository.deleteById(id, orgId);

    // DELETE FROMS3 TODO

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
            Key: `${agent.avatar}`.replace(
              `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/`,
              '',
            ),
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

    return agent;
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
