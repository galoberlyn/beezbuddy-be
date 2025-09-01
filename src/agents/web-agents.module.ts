import { Module } from '@nestjs/common';
import { WebAgentsController } from './web-agents.controller';
import { WebAgentsService } from './web-agents.service';
import { S3Service } from 'src/aws/s3/s3.service';
import { AiModelsService } from 'src/ai-models/ai-models.service';
import { StrategyFactory } from 'src/ai-models/strategies/strategy-factory';
import { LangchainService } from 'src/langchain/langchain.service';
import { AgentRepository } from './agent.repository';
import { DatabaseService } from 'src/database/database.service';
import { EmbeddingRepository } from 'src/embeddings/embedding.repository';
import { N8nService } from 'src/n8n/n8n.service';

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
    EmbeddingRepository,
    N8nService,
  ],
})
export class WebAgentsModule {}
