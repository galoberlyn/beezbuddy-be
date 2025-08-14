import { Module } from '@nestjs/common';
import { AiModelsService } from './ai-models.service';
import { StrategyFactory } from './strategies/strategy-factory';
import { AiModelsConfig } from './config/ai-models.config';

@Module({
  providers: [AiModelsService, StrategyFactory, AiModelsConfig],
  exports: [AiModelsService, StrategyFactory, AiModelsConfig],
})
export class AiModelsModule {}
