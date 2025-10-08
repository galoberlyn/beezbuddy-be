import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeBaseDto } from './create-kb.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { DecodedFirebaseTokenWithCustomClaims } from 'src/auth/guards/types';
import { Request } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('knowledge-bases')
@ApiBearerAuth()
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @UseGuards(FirebaseAuthGuard)
  create(
    @Body() createKnowledgeBaseDto: CreateKnowledgeBaseDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  ) {
    return this.knowledgeBaseService.create(
      createKnowledgeBaseDto,
      files,
      req.user.org,
    );
  }

  @Get()
  @UseGuards(FirebaseAuthGuard)
  getAll(@Req() req: Request & DecodedFirebaseTokenWithCustomClaims) {
    return this.knowledgeBaseService.getAll(req.user.org);
  }

  @Get(':id')
  @UseGuards(FirebaseAuthGuard)
  getById(
    @Param('id') id: string,
    @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  ) {
    return this.knowledgeBaseService.getById(id, req.user.org);
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(AnyFilesInterceptor())
  updateById(
    @Param('id') id: string,
    @Body() formData: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  ) {
    return this.knowledgeBaseService.updateById(
      id,
      formData,
      files,
      req.user.org,
    );
  }
}
