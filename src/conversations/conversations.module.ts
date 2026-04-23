import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import {
	Conversation,
	ConversationSchema,
} from './schemas/conversation.schema';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: Conversation.name, schema: ConversationSchema },
			{ name: User.name, schema: UserSchema },
		]),
	],
	controllers: [ConversationsController],
	providers: [ConversationsService],
})
export class ConversationsModule {}
