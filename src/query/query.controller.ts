import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { QueryService } from './query.service';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { QueryDto } from './dto/query.dto';
import { DecodedFirebaseTokenWithCustomClaims } from 'src/auth/guards/types';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('query')
@ApiBearerAuth()
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @UseGuards(FirebaseAuthGuard)
  @Post('ask')
  async ask(
    @Body() body: QueryDto,
    @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  ) {
    return this.queryService.ask(
      body.question,
      req.user.org,
      req.user.userDbId,
    );
  }
}
