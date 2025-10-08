import { Module } from '@nestjs/common';
import { ConversationsRepository } from './coversations.repository';
import { DatabaseModule } from 'src/database/database.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  controllers: [ConversationsController],
  imports: [DatabaseModule],
  providers: [ConversationsRepository, ConversationsService],
  exports: [ConversationsRepository],
})
export class ConversationModule {}
