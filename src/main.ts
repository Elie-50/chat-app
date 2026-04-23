import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.use(cookieParser());
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
		}),
	);

	const origins = process.env.ORIGIN?.split(',').map((origin) => origin.trim());

	app.enableCors({
		origin: origins,
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
		credentials: true,
	});

	await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
	console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap().catch((err) => {
	console.error('Error during app bootstrap:', err);
	process.exit(1);
});
