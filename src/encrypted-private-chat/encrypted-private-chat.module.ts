import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
	Conversation,
	ConversationSchema,
} from '../conversations/schemas/conversation.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { EncryptedPrivateChatGateway } from './encrypted-private-chat.gateway';
import { EncryptedPrivateChatService } from './encrypted-private-chat.service';
import {
	EncryptedPrivateMessage,
	EncryptedPrivateMessageSchema,
} from './schemas/encrypted-private-message.schema';

@Module({
	providers: [EncryptedPrivateChatGateway, EncryptedPrivateChatService],
	imports: [
		MongooseModule.forFeature([
			{ name: Conversation.name, schema: ConversationSchema },
			{
				name: EncryptedPrivateMessage.name,
				schema: EncryptedPrivateMessageSchema,
			},
			{ name: User.name, schema: UserSchema },
		]),
		NotificationsModule,
	],
})
export class EncryptedPrivateChatModule {}
