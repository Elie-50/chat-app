import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  Response,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response as ExpressResponse } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-code')
  requestCode(@Body() body: { email: string }) {
    return this.authService.requestCode(body.email);
  }

  @Post('verify')
  verifyEmail(
    @Body() body: { email: string; code: string },
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.authService.verify(body.email, body.code, res);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Response() res: ExpressResponse) {
    res.clearCookie('access_token');
    res.send({ message: 'Logged out successfully' });
  }
}
