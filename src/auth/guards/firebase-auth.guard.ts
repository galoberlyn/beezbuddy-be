// src/auth/guards/firebase-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import firebaseAdmin from '../../firebase/firebase-admin';
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
import { Logger } from '@nestjs/common';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const token = this.extractToken(req);

    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const decodedToken: DecodedIdToken = await firebaseAdmin
        .auth()
        .verifyIdToken(token);
      req['user'] = decodedToken;
      return true;
    } catch (err) {
      this.logger.error(err);
      throw new UnauthorizedException('Invalid Firebase token');
    }
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    return parts[0] === 'Bearer' && parts[1] ? parts[1] : null;
  }
}
