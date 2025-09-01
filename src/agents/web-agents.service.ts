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
import { LangchainService } from 'src/langchain/langchain.service';
import { Agents, AgentType, Prisma } from '@prisma/client';
import { AgentRepository } from './agent.repository';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EmbeddingRepository } from 'src/embeddings/embedding.repository';
import { N8nService } from 'src/n8n/n8n.service';
import puppeteer from 'puppeteer';

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
    private readonly n8nService: N8nService,
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
    createWebsiteAgentDto.type = formData['knowledgeBase.type'];

    // Extract knowledge base data
    createWebsiteAgentDto.knowledgeBase = {
      type: formData['knowledgeBase.type'],
      freeText: formData['knowledgeBase.freeText'] as string,
      links:
        formData['knowledgeBase.type'] === 'links'
          ? this.parseLinks(formData)
          : [],
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
    return this.create(createWebsiteAgentDto, organization);
  }

  async create(data: CreateWebsiteAgentDto, organization: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.aiModelService.switchStrategy(ModelType.OLLAMA);
    }
    let s3Url: string | null = null;

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
    const agentPayload: Prisma.AgentsCreateInput = {
      name: data.agentName,
      type: AgentType.website,
      avatar: s3Url,
      organization: {
        connect: {
          id: organization,
        },
      },
      persona: data.persona,
    };

    if (data.type === 'links' && data.knowledgeBase.links) {
      agentPayload.links = {
        createMany: {
          data: data.knowledgeBase.links.map(link => ({ link })),
        },
      };
    }

    const agent = await this.agentRepository.create(agentPayload);

    if (data.type === 'documents') {
      if (data.knowledgeBase.documents) {
        const documentUrls = await this.processDocumentIngestion(
          data,
          organization,
          agent,
        );
        console.log('documentUrls', documentUrls);
      } else {
        throw new BadRequestException('No documents provided');
      }
    }

    if (data.type === 'plaintext') {
      if (data.knowledgeBase.freeText) {
        await this.processPlainTextIngestion(data, organization, agent);
      } else {
        throw new BadRequestException('No knowledge base provided');
      }
    }

    if (data.type === 'links') {
      if (data.knowledgeBase.links) {
        const links = data.knowledgeBase.links;
        try {
          await this.processLinksIngestion(links, organization, agent, true);
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

  private async processDocumentIngestion(
    data: CreateWebsiteAgentDto,
    organization: string,
    agent: Agents,
  ) {
    const documentUrls: string[] = [];
    console.log(data);

    if (data.knowledgeBase.documents) {
      // Upload documents to S3
      try {
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
      } catch (error) {
        this.logger.error('Failed to upload documents to S3:', error);
        throw error;
      }

      try {
        await this.n8nService.ingestDocument({
          files: data.knowledgeBase.documents,
          agentId: agent.id,
          organizationId: organization,
        });
        return documentUrls;
      } catch (error) {
        this.logger.error('Failed to ingest documents:', error);
        throw error;
      }
    }
  }

  private async processPlainTextIngestion(
    data: CreateWebsiteAgentDto,
    organization: string,
    agent: Agents,
  ) {
    await this.n8nService.ingestPlainText({
      data: data.knowledgeBase.freeText || '',
      agentId: agent.id,
      organizationId: organization,
    });
  }

  private async processLinksIngestion(
    links: string[],
    organization: string,
    agent: Agents,
    isSPA: boolean,
  ) {
    if (isSPA) {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      for (const link of links) {
        const page = await browser.newPage();
        console.log('New page created');
        await page.setDefaultTimeout(30000);
        console.log('Set default timeout');
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        );
        try {
          console.log('Going to link:', link);
          await page.goto(link, { waitUntil: 'networkidle2' });
          const html = await page.content();
          await browser.close();

          await this.n8nService.ingestLinks({
            html,
            agentId: agent.id,
            organizationId: organization,
          });
        } catch (error) {
          this.logger.error('Failed to get HTML for link: ' + link, error);
          throw new HttpException(
            'Provided link is not a valid URL',
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    } else {
      this.logger.log('Not SPA, skipping puppeteer');
      const resp = await fetch(links[0], {
        method: 'GET',
      });
      const html = await resp.text();
      await this.n8nService.ingestLinks({
        html,
        agentId: agent.id,
        organizationId: organization,
      });
    }
  }
}
