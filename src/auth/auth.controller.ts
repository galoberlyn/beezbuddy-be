import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthUserDto } from './dto/create-auth-user.dto';
import { ApiTags } from '@nestjs/swagger';
import { DecodedFirebaseTokenWithCustomClaims } from './guards/types';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  create(@Body() createAuthUserDto: CreateAuthUserDto) {
    return this.authService.create(createAuthUserDto);
  }

  @Get('/me')
  @UseGuards(FirebaseAuthGuard)
  getUser(@Req() req: Request & DecodedFirebaseTokenWithCustomClaims) {
    return this.authService.getUser(req.user);
  }
}
