import {
	WebSocketGateway,
	SubscribeMessage,
	MessageBody,
	WebSocketServer,
	ConnectedSocket,
} from '@nestjs/websockets';
import { GroupChatService } from './group-chat.service';
import { CreateGroupMessageDto } from './dto/create-group-message.dto';
import { UpdateGroupMessageDto } from './dto/update-group-message.dto';
import { HttpException, UseGuards } from '@nestjs/common';
import * as wsAuthGuard from '../auth/ws-auth.guard';
import { Server } from 'socket.io';
import {
	NotificationsGateway,
	type ConversationPopulated,
} from '../notifications/notifications.gateway';

@UseGuards(wsAuthGuard.WsAuthGuard)
@WebSocketGateway({
	namespace: '/group-chat',
	cors: {
		origin: 'http://localhost:5173',
		methods: ['GET', 'POST'],
		allowedHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	},
})
export class GroupChatGateway {
	constructor(
		private readonly groupChatService: GroupChatService,
		private readonly notificationsGateway: NotificationsGateway,
	) {}

	@WebSocketServer() server: Server;

	@SubscribeMessage('send:group-message')
	async create(
		@MessageBody() createGroupMessageDto: CreateGroupMessageDto,
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			const { message, conversation } = await this.groupChatService.create(
				sender._id,
				createGroupMessageDto,
			);

			const conversationId = createGroupMessageDto.id;

			this.server
				.to(`conversation:${conversationId}`)
				.emit('group-message:received', {
					conversationId,
					message,
				});
			this.notificationsGateway.sendGroupNotification({
				conversation: conversation as unknown as ConversationPopulated,
				sender: {
					_id: sender._id,
					username: sender.username || 'a member',
				},
			});
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:group-message', { message: err.message });
		}
	}

	@SubscribeMessage('find:group-messages')
	async findAllGroupChat(
		@MessageBody()
		{
			senderId,
			conversationId,
			page,
			size,
		}: { senderId: string; conversationId: string; page: number; size: number },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		try {
			const result = await this.groupChatService.findAll(
				senderId,
				conversationId,
				page,
				size,
			);

			// Emit the messages for the specific conversation to the client
			this.server
				.to(`conversation:${conversationId}`)
				.emit('group-messages:found', result);
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:group-message', { message: err.message });
		}
	}

	@SubscribeMessage('update:group-message')
	async updateGroupMessage(
		@MessageBody() updateGroupMessageDto: UpdateGroupMessageDto,
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			const { message, conversation } = await this.groupChatService.update(
				sender._id,
				updateGroupMessageDto.messageId,
				updateGroupMessageDto,
			);

			const conversationId = conversation._id.toString();
			this.server
				.to(`conversation:${conversationId}`)
				.emit('group-message:updated', { message });
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:group-message', { message: err.message });
		}
	}

	@SubscribeMessage('remove:group-message')
	async removeGroupMessage(
		@MessageBody() data: { messageId: string },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			const { message, conversation } = await this.groupChatService.remove(
				sender._id,
				data.messageId,
			);

			this.server
				.to(`conversation:${conversation._id.toString()}`)
				.emit('group-message:removed', { message });
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:group-message', { message: err.message });
		}
	}

	@SubscribeMessage('connect:user')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	async connectToSocket(
		@MessageBody() data: { conversationId: string },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		try {
			const user = client.data.payload;
			if (!user) {
				return;
			}

			const { conversationId } = data;

			await client.join(`conversation:${conversationId}`);
			this.server.to(`conversation:${conversationId}`).emit('user:joined', {});
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:private-message', { message: err.message });
		}
	}

	@SubscribeMessage('typing:start')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	handleStartedTyping(
		@MessageBody() data: { conversationId: string },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		try {
			const user = client.data.payload;
			if (!user) {
				return;
			}

			const { conversationId } = data;

			this.server.to(`conversation:${conversationId}`).emit('typing:update', {
				_id: user._id,
				username: user.username,
				isTyping: true,
			});
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:private-message', { message: err.message });
		}
	}

	@SubscribeMessage('typing:stop')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	handleStoppedTyping(
		@MessageBody() data: { conversationId: string },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		try {
			const user = client.data.payload;
			if (!user) {
				return;
			}
			const { conversationId } = data;

			this.server
				.to(`conversation:${conversationId}`)
				.emit('typing:update', { _id: user._id, isTyping: false });
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:private-message', { message: err.message });
		}
	}
}
