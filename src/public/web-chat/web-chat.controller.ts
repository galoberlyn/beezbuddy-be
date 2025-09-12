import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WebChatService } from './web-chat.service';
import { CreateWebChatDto } from './dto/create-web-chat.dto';
import { Request } from 'express';

@Controller('public/web-chat')
@ApiTags('public/web-chat')
export class WebChatController {
  constructor(private readonly webChatService: WebChatService) {}

  @Post('/:orgId/:agentId/:sessionId')
  create(
    @Param('agentId') agentId,
    @Param('orgId') orgId,
    @Param('sessionId') sessionId,
    @Body() createWebChatDto: CreateWebChatDto,
    @Req() req: Request,
  ) {
    return this.webChatService.create(
      agentId,
      orgId,
      sessionId,
      createWebChatDto,
      req,
    );
  }
}
