import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ConversationsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  findByUserId(userId: string, agentId: string) {
    return this.databaseService.conversation.findMany({
      where: {
        userId,
        agentId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
  }
  create(userId: string, question: string, answer: string, agentId: string) {
    return this.databaseService.conversation.create({
      data: {
        userId,
        question,
        answer,
        agentId,
      },
    });
  }
}
