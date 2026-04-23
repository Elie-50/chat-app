import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
	Conversation,
	ConversationSchema,
} from '../conversations/schemas/conversation.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { GroupChatGateway } from './group-chat.gateway';
import { GroupChatService } from './group-chat.service';
import {
	GroupMessage,
	GroupMessageSchema,
} from './schemas/group-message.schema';

@Module({
	providers: [GroupChatGateway, GroupChatService],
	imports: [
		MongooseModule.forFeature([
			{ name: User.name, schema: UserSchema },
			{ name: Conversation.name, schema: ConversationSchema },
			{ name: GroupMessage.name, schema: GroupMessageSchema },
		]),
		NotificationsModule,
	],
})
export class GroupChatModule {}
