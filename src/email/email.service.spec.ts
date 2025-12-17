import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { MailerService } from '@nestjs-modules/mailer';

describe('EmailService', () => {
	let service: EmailService;
	let mailerService: jest.Mocked<MailerService>;

	const mockMailerService = {
		sendMail: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EmailService,
				{ provide: MailerService, useValue: mockMailerService },
			],
		}).compile();

		service = module.get(EmailService);
		mailerService = module.get(MailerService);
	});

	describe('sendVerificationCode', () => {
		it('should send verification email with correct data', async () => {
			mailerService.sendMail.mockResolvedValueOnce(undefined);

			await service.sendVerificationCode('123456', 'test@example.com');

			expect(mailerService.sendMail).toHaveBeenCalledWith({
				to: 'test@example.com',
				subject: 'Email Verification code',
				template: './verify',
				context: { code: '123456' },
			});

			expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
		});
	});
});
