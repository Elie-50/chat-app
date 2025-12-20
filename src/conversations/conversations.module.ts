import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
	Conversation,
	ConversationSchema,
} from './schemas/conversation.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: Conversation.name, schema: ConversationSchema },
		]),
		MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
	],
	controllers: [ConversationsController],
	providers: [ConversationsService],
})
export class ConversationsModule {}
