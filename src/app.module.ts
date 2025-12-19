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
import { ChatModule } from './chat/chat.module';
import { FollowModule } from './follow/follow.module';
import { PrivateChatModule } from './private-chat/private-chat.module';
import { ServeStaticModule } from '@nestjs/serve-static';

@Module({
	imports: [
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
		MongooseModule.forRoot(process.env.MONGO_URI!),
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
		ChatModule,
		FollowModule,
		PrivateChatModule,
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
