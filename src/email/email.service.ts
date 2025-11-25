import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationCode(
    code: string,
    recipientEmail: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: recipientEmail,
      subject: 'Email Verification code',
      template: './verify',
      context: {
        code: code,
      },
    });
  }
}
