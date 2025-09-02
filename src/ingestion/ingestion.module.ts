import { Module } from '@nestjs/common';
import { S3Service } from 'src/aws/s3/s3.service';
import { N8nService } from 'src/n8n/n8n.service';

@Module({
  imports: [],
  controllers: [],
  providers: [N8nService, S3Service],
})
export class IngestionModule {}
