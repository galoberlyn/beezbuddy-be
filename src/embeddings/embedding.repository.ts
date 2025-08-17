import { Injectable } from '@nestjs/common';
import { Embeddings } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class EmbeddingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByAgentId(agentId: string): Promise<Embeddings[]> {
    return this.databaseService.embeddings.findMany({
      where: {
        metadata: {
          path: ['agent_id'],
          equals: agentId,
        },
      },
    });
  }
}
