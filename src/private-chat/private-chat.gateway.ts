import {
	WebSocketGateway,
	SubscribeMessage,
	MessageBody,
	WebSocketServer,
	ConnectedSocket,
} from '@nestjs/websockets';
import { PrivateChatService } from './private-chat.service';
import { Server } from 'socket.io';
import * as wsAuthGuard from '../auth/ws-auth.guard';
import { HttpException, UseGuards } from '@nestjs/common';
import { CreatePrivateMessageDto } from './dto/create-private-chat.dto';

@WebSocketGateway({
	namespace: '/private-chat',
	cors: {
		origin: 'http://localhost:5173',
		methods: ['GET', 'POST'],
		allowedHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	},
})
export class PrivateChatGateway {
	constructor(private readonly privateChatService: PrivateChatService) {}

	@WebSocketServer()
	server: Server;

	// Send a private message
	@SubscribeMessage('send:private-message')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	async handleSendMessage(
		@MessageBody() data: CreatePrivateMessageDto,
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			const { conversation, message } = await this.privateChatService.create(
				sender._id,
				{
					recipientId: data.recipientId,
					content: data.content,
				},
			);

			// Join the conversation room
			await client.join(`conversation:${conversation._id.toString()}`);

			// Emit message to all participants in the conversation
			this.server
				.to(`conversation:${conversation._id.toString()}`)
				.emit('receive:private-message', {
					conversationId: conversation._id,
					message,
				});
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:private-message', { message: err.message });
		}
	}

	// Get all messages for a conversation between sender and recipient
	@SubscribeMessage('find:private-messages')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	async handleFindAll(
		@MessageBody() data: { recipientId: string; page?: number; size?: number },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			const {
				data: messages,
				total,
				totalPages,
			} = await this.privateChatService.findAll(
				sender._id,
				data.recipientId,
				data.page || 1,
				data.size || 20,
			);

			// If there are messages, join the conversation room
			if (messages.length > 0) {
				const conversationId = messages[0].conversation._id.toString();
				await client.join(`conversation:${conversationId}`);
			}

			client.emit('conversation-messages', {
				data: messages,
				total,
				totalPages,
			});
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:private-message', { message: err.message });
		}
	}

	// Update a message
	@SubscribeMessage('update:private-message')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	async handleUpdateMessage(
		@MessageBody() data: { messageId: string; content: string },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			const { message: updatedMessage, conversation } =
				await this.privateChatService.update(sender._id, data.messageId, {
					content: data.content,
				});

			this.server
				.to(`conversation:${conversation._id.toString()}`)
				.emit('update:private-message', { message: updatedMessage });
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:private-message', { message: err.message });
		}
	}

	// Delete a message
	@SubscribeMessage('delete:private-message')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	async handleDeleteMessage(
		@MessageBody() data: { messageId: string },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			const { message: deletedMessage, conversation } =
				await this.privateChatService.remove(sender._id, data.messageId);

			this.server
				.to(`conversation:${conversation._id.toString()}`)
				.emit('delete:private-message', { messageId: deletedMessage._id });
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:private-message', { message: err.message });
		}
	}
}
