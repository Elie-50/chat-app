import {
	ConnectedSocket,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import * as wsAuthGuard from '../auth/ws-auth.guard';
import { Server, Socket } from 'socket.io';
import { ConversationDocument } from '../conversations/schemas/conversation.schema';
import { UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';

export type Participant = {
	_id: Types.ObjectId;
	username: string;
};

export interface ConversationPopulated
	extends Omit<ConversationDocument, 'participants'> {
	participants: Participant[];
}

@WebSocketGateway({
	namespace: '/notifications',
	cors: {
		origin: 'http://localhost:5173',
		methods: ['GET', 'POST'],
		allowedHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	},
})
export class NotificationsGateway {
	@WebSocketServer() server: Server;
	private users: Map<string, Socket> = new Map();

	@UseGuards(wsAuthGuard.WsAuthGuard)
	@SubscribeMessage('auth:init')
	handleAuthInit(@ConnectedSocket() client: wsAuthGuard.CustomSocket) {
		const user = client.data.payload;
		if (!user) {
			return { ok: false };
		}

		this.users.set(user._id, client);
		return { ok: true };
	}

	@UseGuards(wsAuthGuard.WsAuthGuard)
	sendGroupNotification(data: {
		conversation: ConversationPopulated;
		sender: { _id: string; username: string };
	}) {
		const { conversation, sender } = data;
		const participants = conversation.participants;

		participants.map((participant) => {
			const participantId = participant._id.toString();
			if (participantId !== sender._id) {
				const userSocket = this.users.get(participantId);
				if (userSocket) {
					userSocket.emit('notify:group-message', {
						senderName: sender.username,
						group: {
							_id: conversation._id,
							name: conversation.name,
						},
					});
				}
			}
		});
	}

	@UseGuards(wsAuthGuard.WsAuthGuard)
	sendPrivateNotification(data: {
		sender: { _id: string; username: string };
		receiverId: string;
	}) {
		const { sender, receiverId } = data;
		const userSocket = this.users.get(receiverId);

		if (userSocket) {
			userSocket.emit('notify:private-message', {
				sender,
			});
		}
	}
}
