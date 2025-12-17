/* eslint-disable @typescript-eslint/no-unsafe-call */
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
import { FollowDocument, Follow } from '../src/follow/schemas/follow.schema';

jest.setTimeout(60000);

describe('Follow (e2e)', () => {
	let app: INestApplication;
	let userModel: mongoose.Model<UserDocument>;
	let followModel: mongoose.Model<FollowDocument>;
	const mockEmailService = {
		sendVerificationCode: jest.fn().mockResolvedValue(true),
	};

	let tokenUser1: string;
	let tokenUser2: string;
	let user1: UserDocument;
	let user2: UserDocument;

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

	beforeEach(async () => {
		const verificationDue = new Date(Date.now() + 2 * 3600 * 1000);

		user1 = await userModel.create({
			email: 'user1@example.com',
			username: 'user1',
			verificationCode: '111111',
			verificationDue,
		});

		user2 = await userModel.create({
			email: 'user2@example.com',
			username: 'user2',
			verificationCode: '111111',
			verificationDue,
		});

		const res1 = await request(app.getHttpServer())
			.post('/api/auth/verify')
			.send({ email: user1.email, code: '111111' });
		tokenUser1 = res1.body.accessToken;

		const res2 = await request(app.getHttpServer())
			.post('/api/auth/verify')
			.send({ email: user2.email, code: '111111' });
		tokenUser2 = res2.body.accessToken;
	});

	afterAll(async () => {
		await mongoose.connection.close();
		await app.close();
	});

	afterEach(async () => {
		await followModel.deleteMany({});
		await userModel.deleteMany({});
		jest.clearAllMocks();
	});

	it('should allow a user to follow another user', async () => {
		const res = await request(app.getHttpServer())
			.post('/api/follow')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.send({ id: user2._id.toString() })
			.expect(HttpStatus.CREATED);

		// Service only returns { success: true }
		expect(res.body.success).toBe(true);

		// Ensure Follow document exists in DB
		const followInDb = await followModel.findOne({
			follower: user1._id,
			following: user2._id,
		});
		expect(followInDb).not.toBeNull();
	});

	it('should not allow a user to follow themselves', async () => {
		await request(app.getHttpServer())
			.post('/api/follow')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.send({ id: user1._id.toString() })
			.expect(HttpStatus.BAD_REQUEST);
	});

	it('should not allow following the same user twice', async () => {
		await followModel.create({
			follower: user1._id,
			following: user2._id,
		});

		await request(app.getHttpServer())
			.post('/api/follow')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.send({ id: user2._id.toString() })
			.expect(HttpStatus.BAD_REQUEST);
	});

	it('should return 404 when trying to follow a non-existent user', async () => {
		const fakeUserId = new mongoose.Types.ObjectId().toString();

		await request(app.getHttpServer())
			.post('/api/follow')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.send({ id: fakeUserId })
			.expect(HttpStatus.NOT_FOUND);
	});

	it('should allow a user to unfollow another', async () => {
		await followModel.create({ follower: user1._id, following: user2._id });

		await request(app.getHttpServer())
			.delete(`/api/follow/${user2._id.toString()}`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.NO_CONTENT);

		const followInDb = await followModel.findOne({
			follower: user1._id,
			following: user2._id,
		});
		expect(followInDb).toBeNull();
	});

	it('should return 404 when trying to unfollow a user not followed', async () => {
		await request(app.getHttpServer())
			.delete(`/api/follow/${user2._id.toString()}`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.NOT_FOUND);
	});

	it('should list followers and following', async () => {
		await followModel.create({ follower: user1._id, following: user2._id });

		const followersRes = await request(app.getHttpServer())
			.get(`/api/follow/followers/${user2._id.toString()}`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(followersRes.body.data.length).toBe(1);
		expect(followersRes.body.data[0]._id.toString()).toBe(user1._id.toString());

		const followingRes = await request(app.getHttpServer())
			.get(`/api/follow/following/${user1._id.toString()}`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(followingRes.body.data.length).toBe(1);
		expect(followingRes.body.data[0]._id.toString()).toBe(user2._id.toString());
	});

	it('should paginate followers correctly', async () => {
		// user2 gets 3 followers
		await followModel.create({ follower: user1._id, following: user2._id });

		const user3 = await userModel.create({
			email: 'user3@example.com',
			username: 'user3',
			verificationCode: '111111',
			verificationDue: new Date(Date.now() + 3600000),
		});

		await followModel.create({
			follower: user3._id,
			following: user2._id,
		});

		const res = await request(app.getHttpServer())
			.get(`/api/follow/followers/${user2._id.toString()}?page=1&size=1`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(res.body.data.length).toBe(1);
		expect(res.body.total).toBe(2);
		expect(res.body.totalPages).toBe(2);
	});

	it('should return empty followers and following lists when none exist', async () => {
		const followersRes = await request(app.getHttpServer())
			.get(`/api/follow/followers/${user1._id.toString()}`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(followersRes.body.data).toEqual([]);
		expect(followersRes.body.total).toBe(0);

		const followingRes = await request(app.getHttpServer())
			.get(`/api/follow/following/${user1._id.toString()}`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(followingRes.body.data).toEqual([]);
		expect(followingRes.body.total).toBe(0);
	});

	it('should list my followers and following using /me endpoints', async () => {
		await followModel.create({ follower: user2._id, following: user1._id });

		const myFollowers = await request(app.getHttpServer())
			.get('/api/follow/me/followers')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(myFollowers.body.data.length).toBe(1);
		expect(myFollowers.body.data[0]._id.toString()).toBe(user2._id.toString());

		const myFollowing = await request(app.getHttpServer())
			.get('/api/follow/me/following')
			.set('Authorization', `Bearer ${tokenUser2}`)
			.expect(HttpStatus.OK);

		expect(myFollowing.body.data.length).toBe(1);
		expect(myFollowing.body.data[0]._id.toString()).toBe(user1._id.toString());
	});

	it('should return empty list for /me/followers when user has no followers', async () => {
		const res = await request(app.getHttpServer())
			.get('/api/follow/me/followers')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(res.body.data).toEqual([]);
		expect(res.body.total).toBe(0);
		expect(res.body.page).toBe(1);
	});

	it('should return empty list for /me/following when user follows no one', async () => {
		const res = await request(app.getHttpServer())
			.get('/api/follow/me/following')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(res.body.data).toEqual([]);
		expect(res.body.total).toBe(0);
		expect(res.body.page).toBe(1);
	});

	it('should paginate /me/followers correctly', async () => {
		// user2 + user3 both follow user1
		await followModel.create({ follower: user2._id, following: user1._id });

		const user3 = await userModel.create({
			email: 'user3@example.com',
			username: 'user3',
			verificationCode: '111111',
			verificationDue: new Date(Date.now() + 3600000),
		});

		await followModel.create({ follower: user3._id, following: user1._id });

		const res = await request(app.getHttpServer())
			.get('/api/follow/me/followers?page=1&size=1')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(res.body.data.length).toBe(1);
		expect(res.body.total).toBe(2);
		expect(res.body.totalPages).toBe(2);
	});

	it('should paginate /me/following correctly', async () => {
		await followModel.create({ follower: user1._id, following: user2._id });

		const user3 = await userModel.create({
			email: 'user3@example.com',
			username: 'user3',
			verificationCode: '111111',
			verificationDue: new Date(Date.now() + 3600000),
		});

		await followModel.create({ follower: user1._id, following: user3._id });

		const res = await request(app.getHttpServer())
			.get('/api/follow/me/following?page=1&size=1')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(res.body.data.length).toBe(1);
		expect(res.body.total).toBe(2);
		expect(res.body.totalPages).toBe(2);
	});

	it('should return 401 when accessing /me/followers without auth', async () => {
		await request(app.getHttpServer())
			.get('/api/follow/me/followers')
			.expect(HttpStatus.UNAUTHORIZED);
	});

	it('should return 401 when accessing /me/following without auth', async () => {
		await request(app.getHttpServer())
			.get('/api/follow/me/following')
			.expect(HttpStatus.UNAUTHORIZED);
	});
});
