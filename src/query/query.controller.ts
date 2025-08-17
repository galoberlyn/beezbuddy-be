import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { QueryService } from './query.service';
import { FirebaseAuthGuard } from 'src/auth/guards/firebase-auth.guard';
import { QueryDto } from './dto/query.dto';
import { DecodedFirebaseTokenWithCustomClaims } from 'src/auth/guards/types';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('query')
@ApiBearerAuth()
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  // @UseGuards(FirebaseAuthGuard)
  // @Post('ask')
  // async ask(
  //   @Body() body: QueryDto,
  //   @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  // ) {
  //   return this.queryService.ask(
  //     body.question,
  //     req.user.org,
  //     req.user.userDbId,
  //   );
  // }

  @UseGuards(FirebaseAuthGuard)
  @Post('ask/test/:agentId')
  async askTest(
    @Body() body: QueryDto,
    @Param('agentId') agentId: string,
    @Req() req: Request & DecodedFirebaseTokenWithCustomClaims,
  ) {
    return await this.queryService.askTest(
      body.question,
      req.user.org,
      req.user.userDbId,
      agentId,
    );
  }
}
