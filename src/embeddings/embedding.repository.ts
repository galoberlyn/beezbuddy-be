import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class EmbeddingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByAgentId(agentId: string): Promise<any> {
    return this.databaseService.$queryRaw<any>`
      SELECT id FROM "ai"."embeddings"
      WHERE metadata->>'agentId' = ${agentId}
    `;
  }

  async bulkDelete(ids: string[]) {
    return this.databaseService.$queryRaw<any>`
      DELETE FROM "ai"."embeddings"
      WHERE id = ANY(${ids}::uuid[])
    `;
  }

  // async create(
  //   content: string,
  //   embedding: number[],
  //   metadata: any,
  // ): Promise<any> {
  //   const result = await this.databaseService.$queryRaw<any[]>`
  //     INSERT INTO "ai"."embeddings" (id, content, embedding, metadata, "createdAt")
  //     VALUES (gen_random_uuid(), ${content}, ${embedding}::vector, ${metadata}::jsonb, NOW())
  //     RETURNING *
  //   `;
  //   return result[0];
  // }

  // async createMany(
  //   embeddings: Array<{
  //     content: string;
  //     embedding: number[];
  //     metadata: any;
  //   }>,
  // ): Promise<any[]> {
  //   if (embeddings.length === 0) {
  //     return [];
  //   }

  //   // Use individual inserts for now to avoid complex raw SQL
  //   const createPromises = embeddings.map(embedding =>
  //     this.create(embedding.content, embedding.embedding, embedding.metadata),
  //   );
  //   return Promise.all(createPromises);
  // }
}
