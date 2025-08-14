import { ApiProperty } from '@nestjs/swagger';

export class KnowledgeBaseDto {
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

  @ApiProperty({ description: 'Free text content' })
  freeText: string;
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
    description: 'The knowledge base of the agent',
    type: KnowledgeBaseDto,
  })
  knowledgeBase: KnowledgeBaseDto;

  @ApiProperty({ description: 'The persona of the agent' })
  persona: string;
}
