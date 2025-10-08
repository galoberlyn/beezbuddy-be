import { ApiProperty } from '@nestjs/swagger';

export class CreateKnowledgeBaseDto {
  @ApiProperty({ description: 'The name of the knowledge base' })
  name: string;

  @ApiProperty({ description: 'The description of the knowledge base' })
  description: string;

  @ApiProperty({
    description: 'The source type of the knowledge base',
    type: String,
    required: false,
  })
  type: string;

  @ApiProperty({
    description: 'Array of links but stringified',
    type: Array<{
      link: string;
      isSPA: boolean;
    }>,
    required: false,
  })
  links?: Array<{
    url: string;
    isSPA: boolean;
  }>;

  @ApiProperty({
    description: 'Array of document files',
    type: 'array',
    items: { type: 'string', format: 'binary' },
    required: false,
  })
  documents?: Express.Multer.File[];

  @ApiProperty({ description: 'Free text content', required: false })
  freeText?: string;

  @ApiProperty({ description: 'Agent IDs', required: true })
  agentIds: string[];
}
