import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Agents, Prisma, PrismaClient } from '@prisma/client';
import { firestore } from 'src/firebase/firestore';
import { DefaultArgs } from '@prisma/client/runtime/library';

@Injectable()
export class AgentRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  logger = new Logger(AgentRepository.name);

  create(
    data: Prisma.AgentsCreateInput,
    tx: Omit<
      PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
  ): Promise<Agents> {
    return tx.agents.create({
      data,
    });
  }

  findAllByOrgId(orgId: string): Promise<Agents[]> {
    return this.databaseService.agents.findMany({
      where: {
        organizationId: orgId,
      },
    });
  }

  findById(id: string, orgId: string): Promise<Agents | null> {
    return this.databaseService.agents.findUnique({
      where: {
        id,
        organizationId: orgId,
      },
      include: {
        conversations: true,
        authorizedDomains: true,
        organization: true,
        links: true,
      },
    });
  }

  async deleteById(id: string, orgId: string) {
    try {
      await this.databaseService.$transaction(async tx => {
        this.logger.log('deleting agent web links', id, orgId);
        await tx.agentWebLinks.deleteMany({
          where: { agentId: id },
        });

        await tx.conversation.deleteMany({
          where: { agentId: id },
        });

        await tx.agentDocuments.deleteMany({
          where: { agentId: id },
        });

        await tx.agents.delete({
          where: {
            id,
            organizationId: orgId,
          },
        });

        await tx.agentDocuments.deleteMany({
          where: { agentId: id },
        });

        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM ai."embeddings"
            WHERE metadata->>'agentId' = ${id}
            AND metadata->>'organizationId' = ${orgId};
          `,
        );

        // delete firebase records
        await firestore.collection(orgId).doc(id).delete();
      });

      return true;
    } catch (error) {
      this.logger.error('Error deleting agent', error);
      return false;
    }
  }
}
