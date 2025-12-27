import {
	WebSocketGateway,
	SubscribeMessage,
	ConnectedSocket,
	WebSocketServer,
	MessageBody,
} from '@nestjs/websockets';
import { OnlineService } from './online.service';
import * as wsAuthGuard from '../auth/ws-auth.guard';
import { HttpException, UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';

@WebSocketGateway({
	namespace: '/online',
	cors: {
		origin: 'http://localhost:5173',
		methods: ['GET', 'POST'],
		allowedHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	},
})
export class OnlineGateway {
	constructor(private readonly onlineService: OnlineService) {}
	@WebSocketServer()
	server: Server;

	@SubscribeMessage('user:connected')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	async userConnect(@ConnectedSocket() client: wsAuthGuard.CustomSocket) {
		const user = client.data.payload;
		if (!user) {
			return;
		}
		await this.onlineService.changeUserStatus(user._id, true);

		await client.join(`online:${user._id}`);

		this.server.to(`online:${user._id}`).emit('user:online', {});
	}

	@SubscribeMessage('user:disconnected')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	async userDisconnect(@ConnectedSocket() client: wsAuthGuard.CustomSocket) {
		const user = client.data.payload;
		if (!user) {
			return;
		}
		await this.onlineService.changeUserStatus(user._id, false);

		await client.join(`online:${user._id}`);

		this.server.to(`online:${user._id}`).emit('user:offline', {});
	}

	@SubscribeMessage('user:check-status')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	async checkUserStatus(
		@MessageBody() body: { userId: string },
		@ConnectedSocket() client: wsAuthGuard.CustomSocket,
	) {
		const user = client.data.payload;

		if (!user) {
			return;
		}

		const { userId } = body;

		try {
			const status = await this.onlineService.checkUserOnlineStatus(userId);
			await client.join(`online:${userId}`);
			this.server.to(`online:${userId}`).emit('user:online-status', status);
		} catch (err) {
			const error = err as HttpException;
			this.server
				.to(`online:${user._id}`)
				.emit('error:online', { message: error.message });
		}
	}
}
