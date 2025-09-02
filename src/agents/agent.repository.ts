import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Agents, Prisma } from '@prisma/client';

@Injectable()
export class AgentRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  create(data: Prisma.AgentsCreateInput): Promise<Agents> {
    return this.databaseService.agents.create({
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
      },
    });
  }

  async deleteById(id: string, orgId: string) {
    try {
      await this.databaseService.$transaction(async tx => {
        await this.databaseService.agents.delete({
          where: {
            id,
            organizationId: orgId,
          },
        });

        await tx.agentWebLinks.deleteMany({
          where: { agentId: id },
        });
        await tx.agents.delete({
          where: {
            id,
            organizationId: orgId,
          },
        });
        await tx.conversation.deleteMany({
          where: { agentId: id },
        });

        await tx.agentDocuments.deleteMany({
          where: { agentId: id },
        });

        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "ai.embeddings"
            WHERE metadata->>'agentId' = ${id}
            AND metadata->>'organizationId' = ${orgId};
          `,
        );
      });

      return true;
    } catch (error) {
      console.log('Error deleting agent', error);
      return false;
    }
  }
}
