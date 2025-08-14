import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ConversationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  findByUserId(userId: string) {
    return this.databaseService.conversation.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
  }
  create(userId: string, question: string, answer: string) {
    return this.databaseService.conversation.create({
      data: {
        userId,
        question,
        answer,
      },
    });
  }
}
