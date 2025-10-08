import { ApiProperty } from '@nestjs/swagger';

export class CreateWebsiteAgentDto {
  @ApiProperty({ description: 'The name of the agent' })
  agentName: string;

  @ApiProperty({ description: 'The description of the agent' })
  agentDescription: string;

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
    description: 'The authorized domains of the agent stringified',
    type: Array<{ url: string }>,
    required: false,
  })
  authorizedDomains?: any;

  @ApiProperty({ description: 'The persona of the agent' })
  persona: string;
}
