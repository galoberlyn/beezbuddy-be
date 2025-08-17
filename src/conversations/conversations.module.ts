import { Module } from '@nestjs/common';
import { ConversationsRepository } from './coversations.repository';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ConversationsRepository],
  exports: [ConversationsRepository],
})
export class ConversationModule {}
