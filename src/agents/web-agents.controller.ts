import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Req,
  Get,
  Param,
  // Patch,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { WebAgentsService } from './web-agents.service';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { DecodedFirebaseTokenWithCustomClaims } from 'src/auth/guards/types';

@Controller('agents')
export class WebAgentsController {
  constructor(private readonly webAgentService: WebAgentsService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post('/website')
  @UseInterceptors(AnyFilesInterceptor())
  create(
    @Body() formData: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  ) {
    return this.webAgentService.createFromMultipartFormData(
      formData,
      files,
      req.user.org,
    );
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('/website')
  getWebsiteAgents(@Req() req: Request & DecodedFirebaseTokenWithCustomClaims) {
    return this.webAgentService.getWebsiteAgents(req.user.org);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('/website/:id')
  getWebsiteAgent(
    @Param('id') id: string,
    @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  ) {
    return this.webAgentService.getWebsiteAgent(id, req.user.org);
  }

  // @UseGuards(FirebaseAuthGuard)
  // @Patch('/website/:id')
  // updateWebsiteAgent(
  //   @Param('id') id: string,
  //   @Body() body: any,
  //   @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  // ) {
  //   return this.webAgentService.updateWebsiteAgent(id, body, req.user.org);
  // }
}
