import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import * as path from 'path';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { JwtModule } from '@nestjs/jwt';
import { FollowModule } from './follow/follow.module';
import { PrivateChatModule } from './private-chat/private-chat.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { GroupChatModule } from './group-chat/group-chat.module';
import { ConversationsModule } from './conversations/conversations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { NoThrottlerGuard } from './no-throttler.guard';
import { OnlineModule } from './online/online.module';

const getURI = () => {
	const dbURI =
		process.env.NODE_ENV !== 'test'
			? process.env.MONGO_URI
			: process.env.MONGO_TEST_URI;

	if (!dbURI) {
		console.error('No DB credentials found');
		process.exit(1);
	}

	return dbURI;
};

@Module({
	imports: [
		ThrottlerModule.forRoot({
			throttlers: [
				{
					ttl: 60000,
					limit: 10,
				},
			],
		}),
		ServeStaticModule.forRoot({
			rootPath: path.join(__dirname, '..', 'client'),
			exclude: ['/api/{*test}'],
			serveStaticOptions: {
				fallthrough: true,
			},
		}),
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: '.env',
		}),
		MongooseModule.forRoot(getURI()),
		MailerModule.forRoot({
			transport: {
				host: process.env.SMTP_HOST,
				port: Number(process.env.SMTP_PORT),
				secure: false,
				auth: {
					user: process.env.SMTP_USER,
					pass: process.env.SMTP_PASS,
				},
			},
			template: {
				dir: path.join(__dirname, 'templates'),
				adapter: new HandlebarsAdapter(),
				options: {
					strict: true,
				},
			},
		}),
		JwtModule.register({
			global: true,
			secret: process.env.JWT_SECRET,
			signOptions: { expiresIn: '15m' },
		}),
		UsersModule,
		AuthModule,
		EmailModule,
		FollowModule,
		PrivateChatModule,
		GroupChatModule,
		ConversationsModule,
		NotificationsModule,
		OnlineModule,
	],
	controllers: [],
	providers: [
		{
			provide: APP_GUARD,
			useClass:
				process.env.NODE_ENV === 'test' ? NoThrottlerGuard : ThrottlerGuard,
		},
	],
})
export class AppModule {}
