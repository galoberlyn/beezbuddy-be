import { Controller, Get, Logger, Param, Req, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { DecodedFirebaseTokenWithCustomClaims } from 'src/auth/guards/types';

@Controller('conversations')
export class ConversationsController {
  logger = new Logger(ConversationsController.name);
  constructor(private readonly conversationsService: ConversationsService) {}

  @UseGuards(FirebaseAuthGuard)
  @Get('/:agentId')
  async getConversations(
    @Param('agentId') agentId: string,
    @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  ) {
    return await this.conversationsService.getConversations(
      req.userDbId,
      agentId,
    );
  }
}
