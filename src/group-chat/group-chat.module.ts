import { Module } from '@nestjs/common';
import { GroupChatService } from './group-chat.service';
import { GroupChatGateway } from './group-chat.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
	Conversation,
	ConversationSchema,
} from '../conversations/schemas/conversation.schema';
import {
	GroupMessage,
	GroupMessageSchema,
} from './schemas/group-message.schema';

@Module({
	providers: [GroupChatGateway, GroupChatService],
	imports: [
		MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
		MongooseModule.forFeature([
			{ name: Conversation.name, schema: ConversationSchema },
		]),
		MongooseModule.forFeature([
			{ name: GroupMessage.name, schema: GroupMessageSchema },
		]),
	],
})
export class GroupChatModule {}
