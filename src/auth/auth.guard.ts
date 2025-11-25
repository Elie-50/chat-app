import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { JwtPayload } from './auth.service';

const JWT_SECRET: string = process.env.JWT_SECRET!;

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload | null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: AuthenticatedRequest = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromCookie(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: JWT_SECRET,
      });

      request.user = payload;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromCookie(
    request: AuthenticatedRequest,
  ): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const authToken: string | undefined = request.cookies['access_token'];
    return authToken;
  }
}
