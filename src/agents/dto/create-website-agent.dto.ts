import { ApiProperty } from '@nestjs/swagger';

export class KnowledgeBaseDto {
  @ApiProperty({
    description: 'The source type of the knowledge base',
    type: String,
    required: false,
  })
  type: string;

  @ApiProperty({
    description: 'Array of links',
    type: [String],
    required: false,
  })
  links?: string[];

  @ApiProperty({
    description: 'Array of document files',
    type: 'array',
    items: { type: 'string', format: 'binary' },
    required: false,
  })
  documents?: Express.Multer.File[];

  @ApiProperty({ description: 'Free text content', required: false })
  freeText?: string;
}

export class CreateWebsiteAgentDto {
  @ApiProperty({ description: 'The name of the agent' })
  agentName: string;

  @ApiProperty({
    description: 'The avatar file of the agent',
    type: 'string',
    format: 'binary',
    required: false,
  })
  avatar?: Express.Multer.File;

  @ApiProperty({
    description: 'links | documents | plaintext',
    type: String,
    required: false,
  })
  type?: string;

  @ApiProperty({
    description: 'The knowledge base of the agent',
    type: KnowledgeBaseDto,
  })
  knowledgeBase: KnowledgeBaseDto;

  @ApiProperty({ description: 'The persona of the agent' })
  persona: string;
}
