import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { FollowModule } from './follow/follow.module';
import { MailModule } from './mail/mail.module';
import { NoThrottlerGuard } from './no-throttler.guard';
import { NotificationsModule } from './notifications/notifications.module';
import { OnlineModule } from './online/online.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { GroupChatModule } from './group-chat/group-chat.module';
import { PrivateChatModule } from './private-chat/private-chat.module';

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
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
		}),
		MongooseModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				uri: config.get<string>('MONGO_URI'),
			}),
		}),
		JwtModule.register({
			global: true,
			secret: process.env.JWT_SECRET,
			signOptions: {
				expiresIn: '15m',
			},
		}),
		UsersModule,
		AuthModule,
		FollowModule,
		// EncryptedPrivateChatModule,
		PrivateChatModule,
		GroupChatModule,
		ConversationsModule,
		NotificationsModule,
		OnlineModule,
		RedisModule,
		MailModule,
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
