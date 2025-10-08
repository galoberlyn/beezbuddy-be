// knowledge-base.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { AgentRepository } from 'src/agents/agent.repository';
import { IngestionService } from 'src/ingestion/ingestion.service';
import { S3Service } from 'src/aws/s3/s3.service';
import { N8nService } from 'src/n8n/n8n.service';
import { EmbeddingRepository } from 'src/embeddings/embedding.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseService,
    AgentRepository,
    IngestionService,
    S3Service,
    N8nService,
    EmbeddingRepository,
  ],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
