import { Test, TestingModule } from '@nestjs/testing';
import { GroupChatGateway } from './group-chat.gateway';
import { GroupChatService } from './group-chat.service';
import { HttpException } from '@nestjs/common';
import { Server } from 'socket.io';
import { CustomSocket } from '../auth/ws-auth.guard';

// Mock GroupChatService
jest.mock('./group-chat.service');
jest.mock('../auth/ws-auth.guard');

describe('GroupChatGateway', () => {
	let gateway: GroupChatGateway;
	let groupChatService: GroupChatService;
	let server: Server;
	let client: CustomSocket;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GroupChatGateway,
				{
					provide: GroupChatService,
					useValue: {
						create: jest.fn(),
						findAll: jest.fn(),
						update: jest.fn(),
						remove: jest.fn(),
						addMember: jest.fn(),
						removeMember: jest.fn(),
					},
				},
			],
		}).compile();

		gateway = module.get<GroupChatGateway>(GroupChatGateway);
		groupChatService = module.get<GroupChatService>(GroupChatService);

		// Mock the WebSocket server and client
		server = {
			to: jest.fn().mockReturnThis(),
			emit: jest.fn(),
			// Add more server methods if needed
		} as any;

		client = {
			data: {
				payload: { _id: 'senderId' },
			},
			join: jest.fn(),
			emit: jest.fn(),
		} as any;

		gateway.server = server;
	});

	describe('create()', () => {
		it('should emit a message when creating a new group message', async () => {
			const createGroupMessageDto = {
				conversationId: 'conversationId',
				content: 'Hello, World!',
			};
			const message = {
				_id: 'messageId',
				content: 'Hello, World!',
				sender: { username: 'senderName' },
			};

			groupChatService.create = jest.fn().mockResolvedValue({ message });

			// Call the create method
			await gateway.create(createGroupMessageDto, client);

			// Assert that the server emitted the correct event
			expect(server.to).toHaveBeenCalledWith('conversation:conversationId');
			expect(server.emit).toHaveBeenCalledWith('group-message:received', {
				conversationId: 'conversationId',
				message,
			});
		});

		it('should handle errors correctly', async () => {
			const createGroupMessageDto = {
				conversationId: 'conversationId',
				content: 'Hello, World!',
			};

			groupChatService.create = jest
				.fn()
				.mockRejectedValue(new HttpException('Error', 400));

			await gateway.create(createGroupMessageDto, client);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Error',
			});
		});
	});

	describe('findAllGroupChat()', () => {
		it('should emit the found messages for the specific conversation', async () => {
			const result = {
				data: [{ _id: 'messageId', content: 'Hello' }],
				page: 1,
				size: 20,
				total: 1,
				totalPages: 1,
			};
			groupChatService.findAll = jest.fn().mockResolvedValue(result);

			const findAllDto = {
				senderId: 'senderId',
				conversationId: 'conversationId',
				page: 1,
				size: 20,
			};

			await gateway.findAllGroupChat(findAllDto, client);

			expect(server.to).toHaveBeenCalledWith('conversation:conversationId');
			expect(server.emit).toHaveBeenCalledWith('group-messages:found', result);
		});

		it('should handle errors correctly', async () => {
			groupChatService.findAll = jest
				.fn()
				.mockRejectedValue(new HttpException('Error', 400));

			const findAllDto = {
				senderId: 'senderId',
				conversationId: 'conversationId',
				page: 1,
				size: 20,
			};

			await gateway.findAllGroupChat(findAllDto, client);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Error',
			});
		});
	});

	describe('updateGroupMessage()', () => {
		it('should emit the updated message', async () => {
			const updateGroupMessageDto = {
				id: 'messageId',
				conversationId: 'conversationId',
				content: 'Updated content',
			};
			const message = {
				_id: 'messageId',
				content: 'Updated content',
				sender: { username: 'senderName' },
			};

			groupChatService.update = jest.fn().mockResolvedValue({ message });

			await gateway.updateGroupMessage(updateGroupMessageDto, client);

			expect(server.to).toHaveBeenCalledWith('conversation:conversationId');
			expect(server.emit).toHaveBeenCalledWith('group-message:updated', {
				message,
			});
		});

		it('should handle errors correctly', async () => {
			const updateGroupMessageDto = {
				id: 'messageId',
				conversationId: 'conversationId',
				content: 'Updated content',
			};

			groupChatService.update = jest
				.fn()
				.mockRejectedValue(new HttpException('Error', 400));

			await gateway.updateGroupMessage(updateGroupMessageDto, client);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Error',
			});
		});
	});

	describe('removeGroupMessage()', () => {
		it('should emit the removed message event', async () => {
			const messageId = 'messageId';
			const message = { _id: messageId, content: 'Hello' };
			const conversation = { _id: 'conversationId' };

			groupChatService.remove = jest
				.fn()
				.mockResolvedValue({ message, conversation });

			await gateway.removeGroupMessage(messageId, client);

			expect(server.to).toHaveBeenCalledWith('conversation:conversationId');
			expect(server.emit).toHaveBeenCalledWith('group-message:removed', {
				message,
			});
		});

		it('should handle errors correctly', async () => {
			const messageId = 'messageId';
			groupChatService.remove = jest
				.fn()
				.mockRejectedValue(new HttpException('Error', 400));

			await gateway.removeGroupMessage(messageId, client);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Error',
			});
		});
	});

	describe('addMember()', () => {
		it('should emit the member added event', async () => {
			const addMemberDto = {
				memberId: 'memberId',
				conversationId: 'conversationId',
			};

			groupChatService.addMember = jest.fn().mockResolvedValue(undefined);

			await gateway.addMember(addMemberDto, client);

			expect(server.to).toHaveBeenCalledWith('conversation:conversationId');
			expect(server.emit).toHaveBeenCalledWith('member:added', {
				memberId: 'memberId',
			});
		});

		it('should handle errors correctly', async () => {
			const addMemberDto = {
				memberId: 'memberId',
				conversationId: 'conversationId',
			};

			groupChatService.addMember = jest
				.fn()
				.mockRejectedValue(new HttpException('Error', 400));

			await gateway.addMember(addMemberDto, client);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Error',
			});
		});
	});

	describe('removeMember()', () => {
		it('should emit the member removed event', async () => {
			const removeMemberDto = {
				memberId: 'memberId',
				conversationId: 'conversationId',
			};

			groupChatService.removeMember = jest.fn().mockResolvedValue(undefined);

			await gateway.removeMember(removeMemberDto, client);

			expect(server.to).toHaveBeenCalledWith('conversation:conversationId');
			expect(server.emit).toHaveBeenCalledWith('member:removed', {
				memberId: 'memberId',
			});
		});

		it('should handle errors correctly', async () => {
			const removeMemberDto = {
				memberId: 'memberId',
				conversationId: 'conversationId',
			};

			groupChatService.removeMember = jest
				.fn()
				.mockRejectedValue(new HttpException('Error', 400));

			await gateway.removeMember(removeMemberDto, client);

			expect(client.emit).toHaveBeenCalledWith('error:private-message', {
				message: 'Error',
			});
		});
	});
});
