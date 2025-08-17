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
    });
  }
}
