import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { JwtPayload } from './auth.service';

const JWT_SECRET: string = process.env.JWT_SECRET!;

export interface CustomSocket extends Socket {
  data: {
    payload?: JwtPayload | null;
  };
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the socket client from the WebSocket context
    const client = context.switchToWs().getClient<CustomSocket>();

    // Extract the token from the WebSocket handshake (auth object)
    const token = (client.handshake as { auth: { token?: string } }).auth.token;

    if (!token) {
      return false;
    }

    try {
      // Verify the JWT token
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: JWT_SECRET,
      });

      // Attach the user info to the socket context
      client.data.payload = payload;
    } catch {
      return false;
    }

    return true;
  }
}
