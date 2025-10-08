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
        knowledgeBases: true,
      },
    });
  }

  findAllByIds(ids: string[], orgId: string): Promise<Agents[]> {
    return this.databaseService.agents.findMany({
      where: {
        id: { in: ids },
        organizationId: orgId,
      },
    });
  }

  async deleteById(id: string, orgId: string) {
    try {
      await this.databaseService.$transaction(async tx => {
        await tx.agents.delete({
          where: {
            id,
            organizationId: orgId,
          },
        });

        // remove the agent id from the embeddings metadata
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE ai."embeddings"
            SET metadata = jsonb_set(
                metadata,
                '{agentIds}',
                (
                  SELECT jsonb_agg(elem)
                  FROM jsonb_array_elements_text(metadata->'agentIds') elem
                  WHERE elem <> ${id}
                )
            )
            WHERE metadata->'agentIds' @> to_jsonb(${id}::text)
            AND metadata->>'organizationId' = ${orgId};
          `,
        );

        await firestore.collection(orgId).doc(id).delete();
      });

      return true;
    } catch (error) {
      this.logger.error('Error deleting agent', error);
      return false;
    }
  }
}
