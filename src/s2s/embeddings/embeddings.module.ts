import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingRepository } from 'src/embeddings/embedding.repository';
import { DatabaseModule } from 'src/database/database.module';
import { EmbeddingsController } from './embeddings.controller';

@Module({
  providers: [EmbeddingsService, EmbeddingRepository],
  imports: [DatabaseModule],
  controllers: [EmbeddingsController],
})
export class EmbeddingsModule {}
