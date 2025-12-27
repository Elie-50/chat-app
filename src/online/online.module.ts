import { Module } from '@nestjs/common';
import { OnlineService } from './online.service';
import { OnlineGateway } from './online.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
	imports: [
		MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
	],
	providers: [OnlineGateway, OnlineService],
})
export class OnlineModule {}
