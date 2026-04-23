import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';
import { Follow, FollowSchema } from './schemas/follow.schema';

@Module({
	controllers: [FollowController],
	imports: [
		MongooseModule.forFeature([
			{ name: User.name, schema: UserSchema },
			{ name: Follow.name, schema: FollowSchema },
		]),
	],
	providers: [FollowService],
})
export class FollowModule {}
