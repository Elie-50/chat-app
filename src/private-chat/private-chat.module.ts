import { Module } from '@nestjs/common';
import { PrivateChatService } from './private-chat.service';
import { PrivateChatGateway } from './private-chat.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import {
	Conversation,
	ConversationSchema,
} from '../chat/schemas/conversation.schema';
import {
	PrivateMessage,
	PrivateMessageSchema,
} from './schemas/private-message.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
	providers: [PrivateChatGateway, PrivateChatService],
	imports: [
		MongooseModule.forFeature([
			{ name: Conversation.name, schema: ConversationSchema },
		]),
		MongooseModule.forFeature([
			{ name: PrivateMessage.name, schema: PrivateMessageSchema },
		]),
		MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
	],
})
export class PrivateChatModule {}
