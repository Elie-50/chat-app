/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';

import { AppModule } from '../src/app.module';
import { EmailService } from '../src/email/email.service';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import {
	Conversation,
	ConversationDocument,
} from '../src/conversations/schemas/conversation.schema';

jest.setTimeout(60000);

describe('Conversations (e2e)', () => {
	let app: INestApplication;
	let userModel: mongoose.Model<UserDocument>;
	let conversationModel: mongoose.Model<ConversationDocument>;

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

		userModel = moduleFixture.get(getModelToken(User.name));
		conversationModel = moduleFixture.get(getModelToken(Conversation.name));
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

	afterEach(async () => {
		await conversationModel.deleteMany({});
		await userModel.deleteMany({});
		jest.clearAllMocks();
	});

	afterAll(async () => {
		await mongoose.connection.close();
		await app.close();
	});

	it('should create a conversation', async () => {
		const res = await request(app.getHttpServer())
			.post('/api/conversations')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.send({ name: 'My Group' })
			.expect(HttpStatus.CREATED);

		expect(res.body.name).toBe('My Group');
		expect(res.body.type).toBe('group');

		const convoInDb = await conversationModel.findById(res.body._id);
		expect(convoInDb).not.toBeNull();
		expect(convoInDb!.admin!.toString()).toBe(user1._id.toString());
	});

	it('should list conversations for current user', async () => {
		await conversationModel.create({
			name: 'Test',
			type: 'group',
			admin: user1._id,
			participants: [user1._id],
		});

		const res = await request(app.getHttpServer())
			.get('/api/conversations')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(res.body.data.length).toBe(1);
		expect(res.body.total).toBe(1);
		expect(res.body.page).toBe(1);
	});

	it('should paginate conversations', async () => {
		await conversationModel.create([
			{
				name: 'C1',
				type: 'group',
				admin: user1._id,
				participants: [user1._id],
			},
			{
				name: 'C2',
				type: 'group',
				admin: user1._id,
				participants: [user1._id],
			},
		]);

		const res = await request(app.getHttpServer())
			.get('/api/conversations?page=1&size=1')
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(res.body.data.length).toBe(1);
		expect(res.body.total).toBe(2);
		expect(res.body.totalPages).toBe(2);
	});

	it('should get a conversation by id', async () => {
		const convo = await conversationModel.create({
			name: 'Private',
			type: 'group',
			admin: user1._id,
			participants: [user1._id],
		});

		const res = await request(app.getHttpServer())
			.get(`/api/conversations/${convo._id.toString()}`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.OK);

		expect(res.body._id.toString()).toBe(convo._id.toString());
	});

	it('should return 404 for non-existing conversation', async () => {
		const fakeId = new mongoose.Types.ObjectId().toString();

		await request(app.getHttpServer())
			.get(`/api/conversations/${fakeId}`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.expect(HttpStatus.NOT_FOUND);
	});

	it('should allow admin to update conversation name', async () => {
		const convo = await conversationModel.create({
			name: 'Old',
			type: 'group',
			admin: user1._id,
			participants: [user1._id],
		});

		const res = await request(app.getHttpServer())
			.patch(`/api/conversations/${convo._id.toString()}`)
			.set('Authorization', `Bearer ${tokenUser1}`)
			.send({ name: 'New Name' })
			.expect(HttpStatus.OK);

		expect(res.body.name).toBe('New Name');
	});

	it('should forbid non-admin from updating conversation', async () => {
		const convo = await conversationModel.create({
			name: 'Group',
			type: 'group',
			admin: user1._id,
			participants: [user1._id, user2._id],
		});

		await request(app.getHttpServer())
			.patch(`/api/conversations/${convo._id.toString()}`)
			.set('Authorization', `Bearer ${tokenUser2}`)
			.send({ name: 'Hack' })
			.expect(HttpStatus.FORBIDDEN);
	});

	it('should return 401 when accessing conversations without auth', async () => {
		await request(app.getHttpServer())
			.get('/api/conversations')
			.expect(HttpStatus.UNAUTHORIZED);
	});
});
