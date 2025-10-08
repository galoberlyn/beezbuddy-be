import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateKnowledgeBaseDto } from './create-kb.dto';
import { AgentRepository } from 'src/agents/agent.repository';
import { IngestionService } from 'src/ingestion/ingestion.service';
import { DatabaseService } from 'src/database/database.service';
import { Agents, KnowledgeBase, KnowledgeBaseType } from '@prisma/client';
import { firestore } from 'src/firebase/firestore';
import { EmbeddingRepository } from 'src/embeddings/embedding.repository';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly ingestionService: IngestionService,
    private readonly databaseService: DatabaseService,
    private readonly embeddingRepository: EmbeddingRepository,
  ) {}

  logger = new Logger(KnowledgeBaseService.name);

  async create(formData: any, files: Express.Multer.File[], orgId: string) {
    const agents = await this.agentRepository.findAllByIds(
      JSON.parse(formData.assignedAgents),
      orgId,
    );
    if (!agents) {
      throw new BadRequestException('Agents not found');
    }
    const createKnowledgeBaseDto = new CreateKnowledgeBaseDto();

    createKnowledgeBaseDto.name = formData.name;
    createKnowledgeBaseDto.description = formData.description;
    createKnowledgeBaseDto.type = formData.type;
    const ids: string[] = [];

    // update agent status to training
    const batch = firestore.batch();
    agents.forEach((agent: Agents) => {
      ids.push(agent.id);
      const ref = firestore.collection(orgId).doc(agent.id);
      batch.set(ref, { status: 'training' }, { merge: true });
    });
    await batch.commit();

    let knowledgeBase: KnowledgeBase;
    await this.databaseService.$transaction(async tx => {
      knowledgeBase = await tx.knowledgeBase.create({
        data: {
          name: createKnowledgeBaseDto.name,
          description: createKnowledgeBaseDto.description,
          type: createKnowledgeBaseDto.type as KnowledgeBaseType,
          freeText: createKnowledgeBaseDto.freeText || '',
          agents: {
            connect: ids.map(id => ({
              id: id,
            })),
          },
        },
      });
      if (formData.type === 'links') {
        try {
          createKnowledgeBaseDto.links = JSON.parse(formData.links);
          if (createKnowledgeBaseDto.links) {
            await tx.knowledgeBaseWebLinks.createMany({
              data: createKnowledgeBaseDto.links.map(link => ({
                link: link.url,
                isSPA: link.isSPA,
                knowledgeBaseId: knowledgeBase.id,
              })),
            });
            await this.ingestionService.processLinksIngestion(
              createKnowledgeBaseDto.links,
              orgId,
              agents,
              knowledgeBase.id,
            );
          }
        } catch (error) {
          this.logger.error(error);
          throw new BadRequestException('N8N link ingestion failed', error);
        }
      }

      if (formData.type === 'plaintext') {
        if (!formData.freeText) {
          throw new BadRequestException('No free text provided');
        }
        createKnowledgeBaseDto.freeText = formData.freeText;
        await this.ingestionService.processPlainTextIngestion(
          createKnowledgeBaseDto,
          orgId,
          agents,
          [],
        );
      }

      if (formData.type === 'documents') {
        createKnowledgeBaseDto.documents = files.filter(
          file => file.fieldname === 'documents',
        );
        const documentUrls =
          await this.ingestionService.processDocumentIngestion(
            createKnowledgeBaseDto,
            orgId,
            agents,
          );
        if (documentUrls) {
          await tx.knowledgeBaseDocuments.createMany({
            data: documentUrls.map(document => ({
              documentLink: document,
              knowledgeBaseId: knowledgeBase.id,
            })),
          });
        }
      }
    });
  }

  async getAll(orgId: string) {
    return this.databaseService.knowledgeBase.findMany({
      include: {
        agents: true,
        documents: true,
        links: true,
      },
      where: {
        agents: {
          some: {
            organizationId: orgId,
          },
        },
      },
    });
  }

  async getById(id: string, orgId: string) {
    return this.databaseService.knowledgeBase.findUnique({
      where: {
        id,
        agents: {
          some: {
            organizationId: orgId,
          },
        },
      },
      include: {
        agents: true,
        documents: true,
        links: true,
      },
    });
  }

  async updateById(
    id: string,
    formData: any,
    files: Express.Multer.File[],
    orgId: string,
  ) {
    const knowledgeBase = await this.getById(id, orgId);
    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    const updateKnowledgeBaseDto = new CreateKnowledgeBaseDto();
    updateKnowledgeBaseDto.name = formData.name;
    updateKnowledgeBaseDto.description = formData.description;
    updateKnowledgeBaseDto.type = formData.type;
    updateKnowledgeBaseDto.freeText = formData.freeText;

    // Parse links if they exist and are stringified
    if (formData.links) {
      try {
        updateKnowledgeBaseDto.links = JSON.parse(formData.links);
      } catch (error) {
        this.logger.error('Failed to parse links:', error);
      }
    }

    // Handle documents from files
    if (files) {
      updateKnowledgeBaseDto.documents = files.filter(
        file => file.fieldname === 'documents',
      );
    }

    const ids: string[] = [];
    knowledgeBase.agents.forEach((agent: Agents) => {
      ids.push(agent.id);
    });

    // update agent status to training
    const batch = firestore.batch();
    knowledgeBase.agents.forEach((agent: Agents) => {
      ids.push(agent.id);
      const ref = firestore.collection(orgId).doc(agent.id);
      batch.set(ref, { status: 'training' }, { merge: true });
    });
    await batch.commit();

    const embeddingsToReplace = await this.embeddingRepository.findByAgentId(
      ids[0],
    );

    await this.databaseService.$transaction(async tx => {
      // update kb
      await tx.knowledgeBase.update({
        where: {
          id,
          agents: {
            some: {
              organizationId: orgId,
            },
          },
        },
        data: {
          name: updateKnowledgeBaseDto.name,
          description: updateKnowledgeBaseDto.description,
          type: updateKnowledgeBaseDto.type as KnowledgeBaseType,
          freeText: updateKnowledgeBaseDto.freeText || '',
        },
      });

      // update links
      if (updateKnowledgeBaseDto.type === 'links') {
        try {
          if (updateKnowledgeBaseDto.links) {
            await this._deleteKnowledgeBaseAssociations(knowledgeBase.id, tx);

            await tx.knowledgeBaseWebLinks.createMany({
              data: updateKnowledgeBaseDto.links.map(link => ({
                link: link.url,
                isSPA: link.isSPA,
                knowledgeBaseId: knowledgeBase.id,
              })),
            });
            await this.ingestionService.processLinksIngestion(
              updateKnowledgeBaseDto.links,
              orgId,
              knowledgeBase.agents,
              knowledgeBase.id,
              embeddingsToReplace,
            );
          }
        } catch (error) {
          this.logger.error(error);
          throw new BadRequestException('N8N link ingestion failed', error);
        }
      }

      // update free text
      if (updateKnowledgeBaseDto.type === 'plaintext') {
        if (!formData.freeText) {
          throw new BadRequestException('No free text provided');
        }
        await this.ingestionService.processPlainTextIngestion(
          updateKnowledgeBaseDto,
          orgId,
          knowledgeBase.agents,
          embeddingsToReplace,
        );
      }

      // update documents
      if (updateKnowledgeBaseDto.type === 'documents') {
        if (
          updateKnowledgeBaseDto.documents &&
          updateKnowledgeBaseDto.documents.length > 0
        ) {
          await this._deleteKnowledgeBaseAssociations(knowledgeBase.id, tx);

          const documentUrls =
            await this.ingestionService.processDocumentIngestion(
              updateKnowledgeBaseDto,
              orgId,
              knowledgeBase.agents,
            );
          if (documentUrls) {
            await tx.knowledgeBaseDocuments.createMany({
              data: documentUrls.map(document => ({
                documentLink: document,
                knowledgeBaseId: knowledgeBase.id,
              })),
            });
          }
        }
      }
    });
  }

  async _deleteKnowledgeBaseAssociations(kbId: string, tx: any) {
    await tx.knowledgeBaseWebLinks.deleteMany({
      where: {
        knowledgeBaseId: kbId,
      },
    });

    await tx.knowledgeBaseDocuments.deleteMany({
      where: {
        knowledgeBaseId: kbId,
      },
    });

    // @TODO: delete S3 files
  }
}
