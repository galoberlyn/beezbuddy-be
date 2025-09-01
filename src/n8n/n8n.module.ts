import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { N8nService } from './n8n.service';

@Module({
  imports: [DatabaseModule],
  providers: [N8nService],
  exports: [],
})
export class N8nModule {}
