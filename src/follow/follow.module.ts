import { Module } from '@nestjs/common';
import { FollowService } from './follow.service';
import { FollowController } from './follow.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../users/schemas/user.schema';
import { FollowSchema } from './schemas/follow.schema';

@Module({
	controllers: [FollowController],
	imports: [
		MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
		MongooseModule.forFeature([{ name: 'Follow', schema: FollowSchema }]),
	],
	providers: [FollowService],
})
export class FollowModule {}
