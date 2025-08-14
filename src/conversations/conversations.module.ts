import { Module } from '@nestjs/common';
import { ConversationRepository } from './coversations.repository';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ConversationRepository],
  exports: [ConversationRepository],
})
export class ConversationModule {}
