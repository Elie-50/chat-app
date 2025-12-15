import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { MongooseModule } from '@nestjs/mongoose';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/email/email.service';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import mongoose from 'mongoose';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let userModel: mongoose.Model<UserDocument>;
  const mockEmailService = {
    sendVerificationCode: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        // Override the MongooseModule to use the test database
        MongooseModule.forRoot(process.env.MONGO_TEST_URI!),
      ],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    // app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
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
    it('should verify the user and set access_token cookie', async () => {
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

      const updatedUser = await userModel.findOne({ email });
      expect(updatedUser?.verificationCode).toBe('');
    });

    it('should fail if verification code is expired', async () => {
      const email = 'expired@example.com';
      const verificationCode = '654321';
      await userModel.create({
        email,
        verificationCode,
        verificationDue: new Date(Date.now() - 3 * 3600 * 1000), // 3 hours ago
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({ email, code: verificationCode });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toBe('Verification code has expired');
    });
  });
});
