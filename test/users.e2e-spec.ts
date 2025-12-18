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
import { Follow, FollowDocument } from '../src/follow/schemas/follow.schema';

jest.setTimeout(60000);

describe('Users (e2e)', () => {
	let app: INestApplication;
	let userModel: mongoose.Model<UserDocument>;
	let followModel: mongoose.Model<FollowDocument>;
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

		followModel = moduleFixture.get<mongoose.Model<FollowDocument>>(
			getModelToken(Follow.name),
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

	const getToken = async () => {
		const email = 'email@example.com';
		const verificationCode = '111111';
		const verificationDue = new Date(Date.now() + 2 * 3600 * 1000);
		const username = 'xxx';
		const user = await userModel.create({
			email,
			username,
			verificationCode,
			verificationDue,
		});

		const res = await request(app.getHttpServer())
			.post('/api/auth/verify')
			.send({ email, code: verificationCode });

		return { accessToken: res.body.accessToken, user };
	};

	describe('/api/users/search (GET)', () => {
		it('should return paginated users matching the username', async () => {
			// Create some test users
			const users = [
				{
					email: 'a@example.com',
					username: 'alice',
					verificationCode: '111111',
					verificationDue: new Date(Date.now() + 3600 * 1000),
				},
				{
					email: 'b@example.com',
					username: 'bob',
					verificationCode: '111111',
					verificationDue: new Date(Date.now() + 3600 * 1000),
				},
				{
					email: 'c@example.com',
					username: 'carol',
					verificationCode: '111111',
					verificationDue: new Date(Date.now() + 3600 * 1000),
				},
			];
			await userModel.insertMany(users);

			const { accessToken } = await getToken();

			// Search for 'a' should match 'alice'
			const res = await request(app.getHttpServer())
				.get('/api/users/search')
				.query({ username: 'a', page: '1', size: '10' })
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(HttpStatus.OK);

			expect(res.body).toHaveProperty('data');
			expect(res.body.data.length).toBe(2);
			expect(res.body.data[0].username).toBe('alice');
			expect(res.body).toHaveProperty('page', 1);
			expect(res.body).toHaveProperty('size', 10);
			expect(res.body).toHaveProperty('total', 2);
			expect(res.body).toHaveProperty('totalPages', 1);
		});

		it('should return empty array if no username provided', async () => {
			const { accessToken } = await getToken();

			const res = await request(app.getHttpServer())
				.get('/api/users/search')
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(HttpStatus.OK);

			expect(res.body).toEqual({
				data: [],
				page: 1,
				size: 10,
				total: 0,
				totalPages: 0,
			});
		});

		it('should respect pagination', async () => {
			// Create 15 users
			const testUsers = Array.from({ length: 15 }, (_, i) => ({
				email: `user${i}@example.com`,
				username: `user${i}`,
				verificationCode: '111111',
				verificationDue: new Date(Date.now() + 3600 * 1000),
			}));
			await userModel.insertMany(testUsers);

			const { accessToken } = await getToken();

			const res = await request(app.getHttpServer())
				.get('/api/users/search')
				.query({ username: 'user', page: '2', size: '5' })
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(HttpStatus.OK);

			expect(res.body.page).toBe(2);
			expect(res.body.size).toBe(5);
			expect(res.body.total).toBe(15);
			expect(res.body.totalPages).toBe(3);
			expect(res.body.data.length).toBe(5);
		});

		it('should return isFollowing=true when current user follows the found user', async () => {
			// Create searchable users
			const alice = await userModel.create({
				email: 'alice@example.com',
				username: 'alice',
				verificationCode: '111111',
				verificationDue: new Date(Date.now() + 3600 * 1000),
			});

			await userModel.create({
				email: 'alen@example.com',
				username: 'alen',
				verificationCode: '111111',
				verificationDue: new Date(Date.now() + 3600 * 1000),
			});

			// Create and authenticate current user
			const { accessToken, user: currentUser } = await getToken();

			// Current user follows Alice, not Alen
			await followModel.create({
				follower: currentUser._id,
				following: alice._id,
			});

			const res = await request(app.getHttpServer())
				.get('/api/users/search')
				.query({ username: 'a' })
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(HttpStatus.OK);

			expect(res.body.data.length).toBeGreaterThan(0);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const aliceResult = res.body.data.find(
				(u: any) => u.username === 'alice',
			);

			expect(aliceResult).toBeDefined();
			expect(aliceResult._id).toBeDefined();
			expect(aliceResult.isFollowing).toBe(true);

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const alenResult = res.body.data.find((u: any) => u.username === 'alen');

			expect(alenResult).toBeDefined();
			expect(alenResult.isFollowing).toBe(false);
		});
	});
});
