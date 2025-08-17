import { Injectable } from '@nestjs/common';
import { ConversationsRepository } from './coversations.repository';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
  ) {}
}
