import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';

export type JwtPayload = {
  _id: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly emailService: EmailService,
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async requestCode(email: string) {
    const user = await this.userService.findOrCreate(email);

    if (!user) {
      throw new InternalServerErrorException('Unexpected Error Occured');
    }

    await this.emailService.sendVerificationCode(user.verificationCode, email);

    return { message: 'Email sent successfully' };
  }

  async verify(email: string, code: string, @Inject('Response') res: Response) {
    const user = await this.userService.findByEmailAndVerify(email, code);

    if (!user) {
      throw new NotFoundException('No Account with the given email were found');
    }

    const payload: JwtPayload = { _id: user._id.toString() };
    const accessToken = await this.jwtService.signAsync(payload);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000,
      sameSite: 'lax',
    });

    return user;
  }
}
