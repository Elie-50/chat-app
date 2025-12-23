import { Test, TestingModule } from '@nestjs/testing';
import { PrivateChatGateway } from './private-chat.gateway';
import { PrivateChatService } from './private-chat.service';
import { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

describe('PrivateChatGateway', () => {
	let gateway: PrivateChatGateway;
	let mockServer: Partial<Server>;

	const mockSocket = (
		payload: { _id: string } | null = {
			_id: new Types.ObjectId().toHexString(),
		},
	) =>
		({
			data: { payload },
			join: jest.fn(),
			emit: jest.fn(),
			disconnect: jest.fn(),
		}) as unknown as Socket;

	const mockService = {
		create: jest.fn(),
		findAll: jest.fn(),
		update: jest.fn(),
		remove: jest.fn(),
	};

	const mockJwtService = {
		signAsync: jest.fn(),
		verifyAsync: jest.fn(),
	};

	beforeEach(async () => {
		mockServer = {
			to: jest.fn().mockReturnThis(),
			emit: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PrivateChatGateway,
				{ provide: PrivateChatService, useValue: mockService },
				{ provide: JwtService, useValue: mockJwtService },
			],
		}).compile();

		gateway = module.get<PrivateChatGateway>(PrivateChatGateway);
		gateway.server = mockServer as Server;

		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(gateway).toBeDefined();
	});

	describe('handleSendMessage', () => {
		it('should create a message and emit to the room', async () => {
			const client = mockSocket();
			const conversationId = new Types.ObjectId();
			const message = { _id: new Types.ObjectId(), content: 'Hi' };
			const conversation = { _id: conversationId };

			mockService.create.mockResolvedValueOnce({ conversation, message });

			await gateway.handleSendMessage({ id: 'abc', content: 'Hi' }, client);

			expect(mockService.create).toHaveBeenCalledWith(client.data.payload._id, {
				id: 'abc',
				content: 'Hi',
			});
			expect(client.join).toHaveBeenCalledWith(
				`conversation:${conversationId.toString()}`,
			);
			expect(mockServer.to).toHaveBeenCalledWith(
				`conversation:${conversationId.toString()}`,
			);
			expect(mockServer.emit).toHaveBeenCalledWith('private-message:received', {
				conversationId,
				message,
			});
		});

		it('should emit error if service throws', async () => {
			const client = mockSocket();
			const error = new HttpException('Failed', 400);
			mockService.create.mockRejectedValueOnce(error);

			await gateway.handleSendMessage({ id: 'abc', content: 'Hi' }, client);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Failed',
			});
		});
	});

	describe('handleFindAll', () => {
		it('should join conversation room and emit messages', async () => {
			const client = mockSocket();
			const conversationId = new Types.ObjectId();
			const messages = [
				{
					_id: new Types.ObjectId(),
					conversation: { _id: conversationId },
				},
			];
			const total = 1;
			const totalPages = 1;

			const data = {
				data: messages,
				total,
				totalPages,
			};

			mockService.findAll.mockResolvedValueOnce({
				messages: data,
				conversation: { _id: conversationId },
			});

			await gateway.handleFindAll({ recipientId: 'xyz' }, client);

			expect(client.join).toHaveBeenCalledWith(
				`conversation:${conversationId.toString()}`,
			);
			expect(client.emit).toHaveBeenCalledWith('conversation-messages', {
				data: messages,
				total,
				totalPages,
			});
		});

		it('should emit error if service throws', async () => {
			const client = mockSocket();
			const error = new HttpException('Failed', 400);
			mockService.findAll.mockRejectedValueOnce(error);

			await gateway.handleFindAll({ recipientId: 'xyz' }, client);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Failed',
			});
		});
	});

	describe('handleUpdateMessage', () => {
		it('should update message and emit to room', async () => {
			const client = mockSocket();
			const conversationId = new Types.ObjectId();
			const updatedMessage = { _id: new Types.ObjectId(), content: 'Updated' };
			const conversation = { _id: conversationId };

			mockService.update.mockResolvedValueOnce({
				message: updatedMessage,
				conversation,
			});

			await gateway.handleUpdateMessage(
				{ messageId: '1', content: 'Updated' },
				client,
			);

			expect(mockService.update).toHaveBeenCalledWith(
				client.data.payload._id,
				'1',
				{ content: 'Updated' },
			);
			expect(mockServer.to).toHaveBeenCalledWith(
				`conversation:${conversationId.toString()}`,
			);
			expect(mockServer.emit).toHaveBeenCalledWith('private-message:updated', {
				message: updatedMessage,
			});
		});

		it('should emit error if service throws', async () => {
			const client = mockSocket();
			const error = new HttpException('Fail', 400);
			mockService.update.mockRejectedValueOnce(error);

			await gateway.handleUpdateMessage(
				{ messageId: '1', content: 'Updated' },
				client,
			);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Fail',
			});
		});
	});

	describe('handleDeleteMessage', () => {
		it('should delete message and emit to room', async () => {
			const client = mockSocket();
			const conversationId = new Types.ObjectId();
			const deletedMessage = { _id: new Types.ObjectId() };
			const conversation = { _id: conversationId };

			mockService.remove.mockResolvedValueOnce({
				message: deletedMessage,
				conversation,
			});

			await gateway.handleDeleteMessage({ messageId: '1' }, client);

			expect(mockService.remove).toHaveBeenCalledWith(
				client.data.payload._id,
				'1',
			);
			expect(mockServer.to).toHaveBeenCalledWith(
				`conversation:${conversationId.toString()}`,
			);
			expect(mockServer.emit).toHaveBeenCalledWith('private-message:removed', {
				messageId: deletedMessage._id,
			});
		});

		it('should emit error if service throws', async () => {
			const client = mockSocket();
			const error = new HttpException('Fail', 400);
			mockService.remove.mockRejectedValueOnce(error);

			await gateway.handleDeleteMessage({ messageId: '1' }, client);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Fail',
			});
		});
	});
});
