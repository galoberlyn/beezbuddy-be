import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { PublicConversation } from '@prisma/client';

@Injectable()
export class PublicConversationsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findBySessionId(
    sessionId: string,
    agentId: string,
  ): Promise<PublicConversation[]> {
    return await this.databaseService.publicConversation.findMany({
      where: {
        sessionId: sessionId,
        agentId,
      },
    });
  }
}
