import { Module } from '@nestjs/common';
import { EmbeddingRepository } from './embedding.repository';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [EmbeddingRepository],
  imports: [DatabaseModule],
  exports: [],
})
export class EmbeddingModule {}
