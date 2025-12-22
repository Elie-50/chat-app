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
	constructor(private readonly groupChatService: GroupChatService) {}

	@WebSocketServer() server: Server;

	@SubscribeMessage('send:group-message')
	async create(
		@MessageBody() createGroupMessageDto: CreateGroupMessageDto,
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			const { message } = await this.groupChatService.create(
				sender._id,
				createGroupMessageDto,
			);

			const conversationId = createGroupMessageDto.id;

			await client.join(`conversation:${conversationId}`);
			this.server
				.to(`conversation:${conversationId}`)
				.emit('group-message:received', {
					conversationId,
					message,
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
			await client.join(`conversation:${conversationId}`);

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
			// await client.join(`conversation:${conversationId}`);
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

			await client.join(`conversation:${conversation._id.toString()}`);

			this.server
				.to(`conversation:${conversation._id.toString()}`)
				.emit('group-message:removed', { message });
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:group-message', { message: err.message });
		}
	}

	@SubscribeMessage('add:member')
	async addMember(
		@MessageBody()
		{ memberId, conversationId }: { memberId: string; conversationId: string },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			await this.groupChatService.addMember(
				memberId,
				sender._id,
				conversationId,
			);

			this.server
				.to(`conversation:${conversationId}`)
				.emit('member:added', { memberId });
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:group-message', { message: err.message });
		}
	}

	@SubscribeMessage('remove:member')
	async removeMember(
		@MessageBody()
		{ memberId, conversationId }: { memberId: string; conversationId: string },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const sender = client.data.payload;
		if (!sender) return;

		try {
			await this.groupChatService.removeMember(
				memberId,
				sender._id,
				conversationId,
			);

			this.server
				.to(`conversation:${conversationId}`)
				.emit('member:removed', { memberId });
		} catch (error: unknown) {
			const err = error as HttpException;
			client.emit('error:group-message', { message: err.message });
		}
	}
}
