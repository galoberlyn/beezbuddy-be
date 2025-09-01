import { PartialType } from '@nestjs/swagger';
import { CreateWebsiteAgentDto } from './create-website-agent.dto';

export class UpdateWebsiteAgentDto extends PartialType(CreateWebsiteAgentDto) {}
