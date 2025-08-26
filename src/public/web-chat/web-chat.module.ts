import { Module } from '@nestjs/common';
import { WebChatController } from './web-chat.controller';
import { WebChatService } from './web-chat.service';
import { AgentRepository } from 'src/agents/agent.repository';
import { DatabaseService } from 'src/database/database.service';
import { AiModelsService } from 'src/ai-models/ai-models.service';
import { StrategyFactory } from 'src/ai-models/strategies/strategy-factory';

@Module({
  controllers: [WebChatController],
  providers: [
    WebChatService,
    AgentRepository,
    DatabaseService,
    AiModelsService,
    StrategyFactory,
  ],
  exports: [WebChatService],
})
export class WebChatModule {}
