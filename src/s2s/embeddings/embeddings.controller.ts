import { Body, Controller, Delete } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';

@Controller('/s2s/embeddings')
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  @Delete()
  async delete(@Body() body: Array<{ id: string }>) {
    console.log('body', body);
    const ok = await this.embeddingsService.delete(body);

    if (ok) {
      return {
        message: 'Embeddings deleted successfully',
        ok: true,
      };
    }
  }
}
