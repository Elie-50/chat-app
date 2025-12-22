import { Test, TestingModule } from '@nestjs/testing';
import { GroupChatService } from './group-chat.service';
import { getModelToken } from '@nestjs/mongoose';
import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { UpdateGroupMessageDto } from './dto/update-group-message.dto';

describe('GroupChatService', () => {
	let service: GroupChatService;

	const mockConversationModel = {
		findOne: jest.fn(),
		create: jest.fn(),
		findById: jest.fn(),
	};

	const mockGroupMessageModel = {
		create: jest.fn(),
		findById: jest.fn(),
		findByIdAndDelete: jest.fn(),
		countDocuments: jest.fn(),
		find: jest.fn().mockReturnThis(),
		sort: jest.fn().mockReturnThis(),
		populate: jest.fn().mockReturnThis(),
		skip: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		lean: jest.fn(),
	};

	const mockUserModel = {
		findById: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GroupChatService,
				{
					provide: getModelToken('Conversation'),
					useValue: mockConversationModel,
				},
				{
					provide: getModelToken('GroupMessage'),
					useValue: mockGroupMessageModel,
				},
				{
					provide: getModelToken('User'),
					useValue: mockUserModel,
				},
			],
		}).compile();

		service = module.get<GroupChatService>(GroupChatService);

		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('create', () => {
		it('should create a group message successfully', async () => {
			const currentUserId = 'user123';
			const createGroupMessageDto = {
				id: 'conv123',
				content: 'Hello World!',
			};
			const mockConversation = { _id: 'conv123' };
			const mockSender = { _id: 'user123', username: 'testUser' };
			const mockMessage = { _id: 'msg123', content: 'Hello World!' };

			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockUserModel.findById.mockResolvedValue(mockSender);
			mockGroupMessageModel.create.mockResolvedValue(mockMessage);

			const result = await service.create(currentUserId, createGroupMessageDto);

			expect(mockConversationModel.findById).toHaveBeenCalledWith(
				createGroupMessageDto.id,
			);
			expect(mockUserModel.findById).toHaveBeenCalledWith(currentUserId);
			expect(mockGroupMessageModel.create).toHaveBeenCalledWith({
				conversation: mockConversation._id,
				sender: mockSender._id,
				content: createGroupMessageDto.content,
			});
			expect(result).toEqual({
				conversation: mockConversation,
				message: {
					_id: mockMessage._id,
					sender: mockSender.username,
					content: mockMessage.content,
				},
			});
		});

		it('should throw NotFoundException if conversation is not found', async () => {
			const currentUserId = 'user123';
			const createGroupMessageDto = {
				id: 'invalidConvId',
				content: 'Hello World!',
			};

			mockConversationModel.findById.mockResolvedValue(null);

			await expect(
				service.create(currentUserId, createGroupMessageDto),
			).rejects.toThrow(new NotFoundException('conversation not found'));
		});

		it('should throw NotFoundException if user is not found', async () => {
			const currentUserId = 'user123';
			const createGroupMessageDto = {
				id: 'conv123',
				content: 'Hello World!',
			};
			const mockConversation = { _id: 'conv123' };

			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockUserModel.findById.mockResolvedValue(null);

			await expect(
				service.create(currentUserId, createGroupMessageDto),
			).rejects.toThrow(new NotFoundException('User not found'));
		});
	});

	describe('findAll', () => {
		it('should return messages when sender is an admin or participant', async () => {
			const senderId = new Types.ObjectId().toString();
			const conversationId = new Types.ObjectId().toString();
			const page = 1;
			const size = 10;
			const senderObjId = new Types.ObjectId(senderId);
			const conversationObjId = new Types.ObjectId(conversationId);

			const mockConversation = {
				_id: conversationObjId,
				admin: senderObjId,
				participants: [senderObjId],
			};

			const messageId = new Types.ObjectId().toString();

			const mockMessages = [
				{
					_id: messageId,
					content: 'Hello World!',
					sender: { username: 'testUser' },
				},
			];

			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockGroupMessageModel.lean.mockResolvedValue(mockMessages);
			mockGroupMessageModel.countDocuments.mockResolvedValue(
				mockMessages.length,
			);

			const result = await service.findAll(
				senderId,
				conversationId,
				page,
				size,
			);

			expect(mockConversationModel.findById).toHaveBeenCalledWith(
				conversationObjId,
			);
			expect(mockGroupMessageModel.find).toHaveBeenCalledWith({
				conversation: mockConversation._id,
			});
			expect(result).toEqual({
				data: [{ _id: messageId, content: 'Hello World!', sender: 'testUser' }],
				page,
				size,
				total: mockMessages.length,
				totalPages: 1,
			});
		});

		it('should throw NotFoundException if conversation is not found', async () => {
			const senderId = new Types.ObjectId().toString();
			const conversationId = new Types.ObjectId().toString();

			mockConversationModel.findById.mockResolvedValue(null);

			await expect(service.findAll(senderId, conversationId)).rejects.toThrow(
				new NotFoundException('Conversation not found'),
			);
		});

		it('should throw ForbiddenException if sender is not a participant or admin', async () => {
			const senderId = new Types.ObjectId().toString();
			const conversationId = new Types.ObjectId().toString();
			const page = 1;
			const size = 10;
			const conversationObjId = new Types.ObjectId(conversationId);

			const adminId = new Types.ObjectId().toString();
			const memId = new Types.ObjectId().toString();

			const mockConversation = {
				_id: conversationObjId,
				admin: new Types.ObjectId(adminId),
				participants: [new Types.ObjectId(memId)],
			};

			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await expect(
				service.findAll(senderId, conversationId, page, size),
			).rejects.toThrow(
				new ForbiddenException("Cannot access this group's messages"),
			);
		});

		it('should respect pagination size and page', async () => {
			const senderId = new Types.ObjectId().toString();
			const conversationId = new Types.ObjectId().toString();
			const page = 2;
			const size = 5;
			const senderObjId = new Types.ObjectId(senderId);
			const conversationObjId = new Types.ObjectId(conversationId);

			const mockConversation = {
				_id: conversationObjId,
				admin: senderObjId,
				participants: [senderObjId],
			};

			const mockMessages = [
				{
					_id: new Types.ObjectId().toString(),
					content: 'Message 1',
					sender: { username: 'user1' },
				},
				{
					_id: new Types.ObjectId().toString(),
					content: 'Message 2',
					sender: { username: 'user2' },
				},
				{
					_id: new Types.ObjectId().toString(),
					content: 'Message 3',
					sender: { username: 'user3' },
				},
				{
					_id: new Types.ObjectId().toString(),
					content: 'Message 4',
					sender: { username: 'user4' },
				},
				{
					_id: new Types.ObjectId().toString(),
					content: 'Message 5',
					sender: { username: 'user5' },
				},
				{
					_id: new Types.ObjectId().toString(),
					content: 'Message 6',
					sender: { username: 'user6' },
				},
			];

			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockGroupMessageModel.lean.mockResolvedValue(mockMessages.slice(5)); // Page 2
			mockGroupMessageModel.countDocuments.mockResolvedValue(
				mockMessages.length,
			);

			const result = await service.findAll(
				senderId,
				conversationId,
				page,
				size,
			);

			expect(result.data.length).toBe(1);
			expect(result.page).toBe(page);
			expect(result.size).toBe(size);
			expect(result.total).toBe(mockMessages.length);
			expect(result.totalPages).toBe(2);
		});
	});

	describe('update', () => {
		it('should update the message successfully if sender is authorized and content is valid', async () => {
			const senderId = new Types.ObjectId();
			const messageId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const dto = {
				content: 'Updated message content',
			} as UpdateGroupMessageDto;

			const mockMessage = {
				_id: messageId,
				sender: senderId,
				conversation: conversationId,
				content: 'Old message content',
				modification: '',
				save: jest.fn(),
			};

			const mockConversation = {
				_id: conversationId,
				save: jest.fn(),
			};

			const mockUser = { _id: senderId, username: 'senderUsername' };

			// Mock model methods
			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockUserModel.findById.mockResolvedValue(mockUser);

			const result = await service.update(
				senderId.toString(),
				messageId.toString(),
				dto,
			);

			expect(mockGroupMessageModel.findById).toHaveBeenCalledWith(
				messageId.toString(),
			);
			expect(mockConversationModel.findById).toHaveBeenCalledWith(
				conversationId,
			);
			expect(mockUserModel.findById).toHaveBeenCalledWith(senderId);
			expect(mockMessage.content).toBe(dto.content); // Updated content
			expect(mockMessage.modification).toBe('Edited'); // Should be 'Edited'
			expect(mockMessage.save).toHaveBeenCalled();
			expect(result.message.content).toBe(dto.content); // Returned content should match
			expect(result.conversation).toBe(mockConversation); // Conversation should be returned as well
		});

		it('should throw NotFoundException if the message is not found', async () => {
			const senderId = new Types.ObjectId();
			const messageId = new Types.ObjectId();
			const dto = {
				content: 'Updated message content',
			} as UpdateGroupMessageDto;

			mockGroupMessageModel.findById.mockResolvedValue(null);

			await expect(
				service.update(senderId.toString(), messageId.toString(), dto),
			).rejects.toThrow(new NotFoundException('Message not found'));
		});

		it('should throw NotFoundException if the conversation is not found', async () => {
			const senderId = new Types.ObjectId();
			const messageId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const dto = {
				content: 'Updated message content',
			} as UpdateGroupMessageDto;

			const mockMessage = {
				_id: messageId,
				sender: senderId,
				conversation: conversationId,
				content: 'Old message content',
				modification: '',
				save: jest.fn(),
			};

			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(null); // Conversation not found

			await expect(
				service.update(senderId.toString(), messageId.toString(), dto),
			).rejects.toThrow(new NotFoundException('Conversation not found'));
		});

		it('should throw ForbiddenException if the sender is not authorized to update the message', async () => {
			const senderId = new Types.ObjectId(); // Unauthorized sender
			const messageId = new Types.ObjectId();
			const authorizedSenderId = new Types.ObjectId(); // The actual sender of the message
			const dto = {
				content: 'Updated message content',
			} as UpdateGroupMessageDto;

			const mockMessage = {
				_id: messageId,
				sender: authorizedSenderId, // Sender mismatch
				conversation: new Types.ObjectId(),
				content: 'Old message content',
				modification: '',
				save: jest.fn(),
			};

			const mockConversation = { _id: new Types.ObjectId() }; // Mock a valid conversation
			const mockUser = { _id: authorizedSenderId, username: 'senderUsername' };

			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockUserModel.findById.mockResolvedValue(mockUser);

			await expect(
				service.update(senderId.toString(), messageId.toString(), dto),
			).rejects.toThrow(
				new ForbiddenException('You can only edit your own messages'),
			);
		});

		it('should throw NotFoundException if the sender is not found', async () => {
			const senderId = new Types.ObjectId();
			const messageId = new Types.ObjectId();
			const dto = {
				content: 'Updated message content',
			} as UpdateGroupMessageDto;

			const mockMessage = {
				_id: messageId,
				sender: senderId,
				conversation: new Types.ObjectId(),
				content: 'Old message content',
				modification: '',
				save: jest.fn(),
			};

			const mockConversation = { _id: new Types.ObjectId() }; // Mock a valid conversation

			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockUserModel.findById.mockResolvedValue(null); // Simulate user not found

			await expect(
				service.update(senderId.toString(), messageId.toString(), dto),
			).rejects.toThrow(new NotFoundException('User not found'));
		});

		it('should throw BadRequestException if the new content is empty', async () => {
			const senderId = new Types.ObjectId();
			const messageId = new Types.ObjectId();
			const dto = { content: '' } as UpdateGroupMessageDto; // Empty content

			const mockMessage = {
				_id: messageId,
				sender: senderId,
				conversation: new Types.ObjectId(),
				content: 'Old message content',
				modification: '',
				save: jest.fn(),
			};

			const mockConversation = { _id: new Types.ObjectId() }; // Mock a valid conversation
			const mockUser = { _id: senderId, username: 'senderUsername' };

			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockUserModel.findById.mockResolvedValue(mockUser);

			await expect(
				service.update(senderId.toString(), messageId.toString(), dto),
			).rejects.toThrow(new BadRequestException('Cannot leave empty messages'));
		});
	});

	describe('remove', () => {
		it('should remove the message if the current user is the sender or an admin', async () => {
			const currentUserId = new Types.ObjectId();
			const messageId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();

			const mockMessage = {
				_id: messageId,
				sender: currentUserId, // Current user is the sender
				conversation: conversationId,
				content: 'Some message content',
				modification: '',
				save: jest.fn(),
			};

			const deleteResult = {
				_id: mockMessage._id,
				sender: 'senderUsername',
				content: mockMessage.content,
				modification: 'Deleted',
			};

			const mockConversation = {
				_id: conversationId,
				admin: currentUserId, // Current user is the admin
				participants: [currentUserId],
				save: jest.fn(),
			};

			// Mock models
			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(mockConversation);

			const result = await service.remove(
				currentUserId.toString(),
				messageId.toString(),
			);

			expect(mockGroupMessageModel.findById).toHaveBeenCalledWith(
				messageId.toString(),
			);
			expect(mockConversationModel.findById).toHaveBeenCalledWith(
				conversationId,
			);
			expect(mockMessage.modification).toBe('Deleted'); // Message modification should be set to 'Deleted'
			expect(mockMessage.save).toHaveBeenCalled(); // Ensure the message was saved
			expect(result.message).toStrictEqual(deleteResult); // Ensure the returned message is correct
			expect(result.conversation).toBe(mockConversation); // Ensure the returned conversation is correct
		});

		it('should throw NotFoundException if the message is not found', async () => {
			const currentUserId = new Types.ObjectId();
			const messageId = new Types.ObjectId();

			mockGroupMessageModel.findById.mockResolvedValue(null); // Simulate message not found

			await expect(
				service.remove(currentUserId.toString(), messageId.toString()),
			).rejects.toThrow(new NotFoundException('Message not found'));
		});

		it('should throw NotFoundException if the conversation is not found', async () => {
			const currentUserId = new Types.ObjectId();
			const messageId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();

			const mockMessage = {
				_id: messageId,
				sender: currentUserId,
				conversation: conversationId,
				content: 'Some message content',
				modification: '',
				save: jest.fn(),
			};

			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(null); // Simulate conversation not found

			await expect(
				service.remove(currentUserId.toString(), messageId.toString()),
			).rejects.toThrow(new NotFoundException('Conversation not found'));
		});

		it('should throw ForbiddenException if the current user is neither the sender nor an admin', async () => {
			const currentUserId = new Types.ObjectId(); // Unauthorized user
			const messageId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const messageSenderId = new Types.ObjectId(); // Different sender

			const mockMessage = {
				_id: messageId,
				sender: messageSenderId, // Message sender is not the current user
				conversation: conversationId,
				content: 'Some message content',
				modification: '',
				save: jest.fn(),
			};

			const mockConversation = {
				_id: conversationId,
				admin: new Types.ObjectId(), // Different admin
				participants: [messageSenderId],
				save: jest.fn(),
			};

			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await expect(
				service.remove(currentUserId.toString(), messageId.toString()),
			).rejects.toThrow(
				new ForbiddenException('You cannot delete this message'),
			);
		});

		it("should throw ForbiddenException if the current user is not the admin but is trying to delete someone else's message", async () => {
			const currentUserId = new Types.ObjectId(); // User that is neither sender nor admin
			const messageId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const messageSenderId = new Types.ObjectId(); // Different sender

			const mockMessage = {
				_id: messageId,
				sender: messageSenderId,
				conversation: conversationId,
				content: 'Some message content',
				modification: '',
				save: jest.fn(),
			};

			const mockConversation = {
				_id: conversationId,
				admin: new Types.ObjectId(), // Different admin
				participants: [messageSenderId],
				save: jest.fn(),
			};

			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await expect(
				service.remove(currentUserId.toString(), messageId.toString()),
			).rejects.toThrow(
				new ForbiddenException('You cannot delete this message'),
			);
		});

		it('should update the message with "Deleted" if the sender deletes it', async () => {
			const currentUserId = new Types.ObjectId();
			const messageId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();

			const mockMessage = {
				_id: messageId,
				sender: currentUserId, // Sender is the current user
				conversation: conversationId,
				content: 'Some message content',
				modification: '',
				save: jest.fn(),
			};

			const mockConversation = {
				_id: conversationId,
				admin: currentUserId, // Current user is the admin (for this case)
				participants: [currentUserId],
				save: jest.fn(),
			};

			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await service.remove(currentUserId.toString(), messageId.toString());

			expect(mockMessage.modification).toBe('Deleted');
			expect(mockMessage.save).toHaveBeenCalled();
		});

		it('should update the message with "Deleted By Admin" if an admin deletes a message', async () => {
			const currentUserId = new Types.ObjectId(); // Admin
			const messageId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const messageSenderId = new Types.ObjectId(); // Different sender

			const mockMessage = {
				_id: messageId,
				sender: messageSenderId, // Message sender is not the current admin
				conversation: conversationId,
				content: 'Some message content',
				modification: '',
				save: jest.fn(),
			};

			const mockConversation = {
				_id: conversationId,
				admin: currentUserId, // Admin is current user
				participants: [messageSenderId, currentUserId],
				save: jest.fn(),
			};

			mockGroupMessageModel.findById.mockResolvedValue(mockMessage);
			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await service.remove(currentUserId.toString(), messageId.toString());

			expect(mockMessage.modification).toBe('Deleted By Admin');
			expect(mockMessage.save).toHaveBeenCalled();
		});
	});
});
