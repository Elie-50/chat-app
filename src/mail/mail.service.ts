import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
	constructor(private readonly mailer: MailerService) {}

	async sendOtp(email: string, code: string) {
		await this.mailer.sendMail({
			to: email,
			subject: 'Your OTP Code',
			template: 'otp',
			context: {
				code,
				year: new Date().getFullYear(),
			},
		});
	}
}
