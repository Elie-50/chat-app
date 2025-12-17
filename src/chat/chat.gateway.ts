import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import * as wsAuthGuard from '../auth/ws-auth.guard';
import { UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';

@WebSocketGateway({
	cors: {
		origin: process.env.ORIGIN!,
		methods: ['GET', 'POST'],
		allowedHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	},
})
export class ChatGateway implements OnGatewayConnection {
	@WebSocketServer()
	server: Server;

	@UseGuards(wsAuthGuard.WsAuthGuard)
	handleConnection(client: wsAuthGuard.CustomSocket) {
		console.log('New connection attempt', client.id);

		const token = (client.handshake as { auth: { token?: string } }).auth.token;

		if (!token) {
			console.log('NO TOKEN');
			return;
		}
	}

	@SubscribeMessage('send:feed-message')
	@UseGuards(wsAuthGuard.WsAuthGuard)
	handleMessage(
		@MessageBody() data: { message: string; timestamp: string },
		@ConnectedSocket() socket: wsAuthGuard.CustomSocket,
	) {
		const user = socket.data.payload;
		if (!user) {
			return;
		}

		// Broadcast the message to all connected clients
		this.server.emit('feed-message', {
			message: data.message,
			username: user.username,
			timestamp: data.timestamp,
		});
	}
}
