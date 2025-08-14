import { Module } from '@nestjs/common';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { AiModelsService } from 'src/ai-models/ai-models.service';
import { ConversationRepository } from 'src/conversations/coversations.repository';
import { StrategyFactory } from 'src/ai-models/strategies/strategy-factory';
import { DatabaseService } from 'src/database/database.service';

@Module({
  controllers: [QueryController],
  providers: [
    QueryService,
    AiModelsService,
    ConversationRepository,
    StrategyFactory,
    DatabaseService,
  ],
})
export class QueryModule {}
