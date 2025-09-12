import { Injectable } from '@nestjs/common';
import { EmbeddingRepository } from 'src/embeddings/embedding.repository';

@Injectable()
export class EmbeddingsService {
  constructor(private readonly embeddingRepository: EmbeddingRepository) {}

  async delete(body: Array<{ id: string }>) {
    const ids = body.map(b => b.id);
    return this.embeddingRepository.bulkDelete(ids);
  }
}
