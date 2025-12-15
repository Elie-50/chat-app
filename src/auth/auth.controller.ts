import { Body, Controller, Post, Response } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-code')
  requestCode(@Body() body: { email: string }) {
    return this.authService.requestCode(body.email);
  }

  @Post('verify')
  verifyEmail(@Body() body: { email: string; code: string }) {
    return this.authService.verify(body.email, body.code);
  }
}
