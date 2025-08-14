import { Module } from '@nestjs/common';
import { WebAgentsController } from './web-agents.controller';
import { WebAgentsService } from './web-agents.service';
import { S3Service } from 'src/aws/s3/s3.service';
import { AiModelsService } from 'src/ai-models/ai-models.service';
import { StrategyFactory } from 'src/ai-models/strategies/strategy-factory';
import { LangchainService } from 'src/langchain/langchain.service';
import { AgentRepository } from './agent.repository';
import { DatabaseService } from 'src/database/database.service';

@Module({
  controllers: [WebAgentsController],
  providers: [
    WebAgentsService,
    S3Service,
    AiModelsService,
    StrategyFactory,
    LangchainService,
    AgentRepository,
    DatabaseService,
  ],
})
export class WebAgentsModule {}
