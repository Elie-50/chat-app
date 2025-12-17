import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { MongooseModule } from '@nestjs/mongoose';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/email/email.service';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';

jest.setTimeout(60000);

describe('AuthController (e2e)', () => {
	let app: INestApplication;
	let userModel: mongoose.Model<UserDocument>;
	const mockEmailService = {
		sendVerificationCode: jest.fn().mockResolvedValue(true),
	};

	beforeAll(async () => {
		const mongoTestUri = process.env.MONGO_TEST_URI;
		if (!mongoTestUri) {
			console.error('Test URI not defined');
			process.exit(1);
		}
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule, MongooseModule.forRoot(mongoTestUri)],
		})
			.overrideProvider(EmailService)
			.useValue(mockEmailService)
			.compile();

		app = moduleFixture.createNestApplication();
		app.use(cookieParser());
		await app.init();

		userModel = moduleFixture.get<mongoose.Model<UserDocument>>(
			getModelToken(User.name),
		);
	});

	afterAll(async () => {
		await mongoose.connection.close();
		await app.close();
	});

	afterEach(async () => {
		await userModel.deleteMany({});
		jest.clearAllMocks();
	});

	describe('/api/auth/request-code (POST)', () => {
		it('should create a user and send a verification code', async () => {
			const email = 'test@example.com';

			const res = await request(app.getHttpServer())
				.post('/api/auth/request-code')
				.send({ email });

			expect(res.status).toBe(HttpStatus.CREATED || HttpStatus.OK);
			expect(res.body).toEqual({ message: 'Email sent successfully' });
			expect(mockEmailService.sendVerificationCode).toHaveBeenCalled();

			const user = await userModel.findOne({ email });
			expect(user).toBeDefined();
			expect(user?.verificationCode).toHaveLength(6);
		});
	});

	describe('/api/auth/verify (POST)', () => {
		it('should verify the user and set refresh_token cookie', async () => {
			const email = 'test@example.com';
			const verificationCode = '123456';
			const verificationDue = new Date(Date.now() + 2 * 3600 * 1000);
			await userModel.create({ email, verificationCode, verificationDue });

			const res = await request(app.getHttpServer())
				.post('/api/auth/verify')
				.send({ email, code: verificationCode });

			expect(res.status).toBe(HttpStatus.CREATED || HttpStatus.OK);
			expect(res.body.user.email).toBe(email);
			expect(res.body.accessToken).toBeDefined();

			// cookie should be set
			const cookie = res.headers['set-cookie']?.[0] ?? '';
			expect(cookie.includes('refresh_token')).toBe(true);

			const updatedUser = await userModel.findOne({ email });
			expect(updatedUser?.verificationCode).toBe('');
		});

		it('should fail if verification code is expired', async () => {
			const email = 'expired@example.com';
			const verificationCode = '654321';
			await userModel.create({
				email,
				verificationCode,
				verificationDue: new Date(Date.now() - 3 * 3600 * 1000),
			});

			const res = await request(app.getHttpServer())
				.post('/api/auth/verify')
				.send({ email, code: verificationCode });

			expect(res.status).toBe(HttpStatus.BAD_REQUEST);
			expect(res.body.message).toBe('Verification code has expired');
		});
	});

	describe('/api/auth/refresh (POST)', () => {
		it('should return new access token when refresh token cookie is valid', async () => {
			const email = 'refresh@example.com';
			const verificationCode = '111111';
			const verificationDue = new Date(Date.now() + 2 * 3600 * 1000);
			const username = 'username';
			await userModel.create({
				email,
				username,
				verificationCode,
				verificationDue,
			});

			// First verify to get cookie
			const verifyRes = await request(app.getHttpServer())
				.post('/api/auth/verify')
				.send({ email, code: verificationCode });

			const cookies = verifyRes.headers['set-cookie'];

			const refreshRes = await request(app.getHttpServer())
				.post('/api/auth/refresh')
				.set('Cookie', cookies);

			expect(refreshRes.status).toBe(HttpStatus.OK);
			expect(refreshRes.body.accessToken).toBeDefined();
		});

		it('should fail if no refresh token cookie is provided', async () => {
			const res = await request(app.getHttpServer()).post('/api/auth/refresh');

			expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
			expect(res.body.message).toBe('No refresh token found');
		});
	});

	describe('/api/auth/logout (POST)', () => {
		it('should clear refresh token cookie and return success message', async () => {
			const res = await request(app.getHttpServer()).post('/api/auth/logout');

			expect(res.status).toBe(HttpStatus.OK);
			expect(res.body).toEqual({ message: 'Logged out successfully' });

			const cookie = res.headers['set-cookie']?.[0] ?? '';
			expect(cookie.includes('refresh_token')).toBe(true);
		});
	});

	describe('/api/auth/me', () => {
		it('should update the current user and return new access token', async () => {
			const email = 'meupdate@example.com';
			const verificationCode = '123456';
			const verificationDue = new Date(Date.now() + 2 * 3600 * 1000);

			// Create user directly in DB
			await userModel.create({ email, verificationCode, verificationDue });

			// Verify to get tokens
			const verifyRes = await request(app.getHttpServer())
				.post('/api/auth/verify')
				.send({ email, code: verificationCode });

			expect(verifyRes.status).toBe(HttpStatus.CREATED || HttpStatus.OK);
			const accessToken = verifyRes.body.accessToken;
			const cookies = verifyRes.headers['set-cookie'];

			// Perform PATCH /api/auth/me
			const patchRes = await request(app.getHttpServer())
				.patch('/api/auth/me')
				.set('Authorization', `Bearer ${accessToken}`)
				.set('Cookie', cookies)
				.send({ username: 'newName' });

			expect(patchRes.status).toBe(HttpStatus.OK);
			expect(patchRes.body.user.username).toBe('newName');
			expect(patchRes.body.accessToken).toBeDefined();

			// Ensure DB updated
			const updatedUser = await userModel.findOne({ email });
			expect(updatedUser?.username).toBe('newName');
		});
	});
});
