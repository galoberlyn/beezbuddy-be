import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class QueryDto {
  @ApiProperty({ description: 'The question to ask' })
  @IsString()
  question: string;
}
