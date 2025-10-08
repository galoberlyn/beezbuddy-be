import { Injectable } from '@nestjs/common';
import { ConversationsRepository } from './coversations.repository';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
  ) {}

  async getConversations(userId: string, agentId: string) {
    console.log('userId', userId, 'agentId', agentId);
    return await this.conversationsRepository.findByUserId(userId, agentId);
  }
}
