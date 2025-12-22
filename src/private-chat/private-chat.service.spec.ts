import { Test, TestingModule } from '@nestjs/testing';
import { PrivateChatService } from './private-chat.service';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
	NotFoundException,
	ForbiddenException,
	BadRequestException,
} from '@nestjs/common';

describe('PrivateChatService', () => {
	let service: PrivateChatService;

	const mockConversationModel = {
		findOne: jest.fn(),
		create: jest.fn(),
		findById: jest.fn(),
	};

	const mockPrivateMessageModel = {
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
				PrivateChatService,
				{
					provide: getModelToken('Conversation'),
					useValue: mockConversationModel,
				},
				{
					provide: getModelToken('PrivateMessage'),
					useValue: mockPrivateMessageModel,
				},
				{
					provide: getModelToken('User'),
					useValue: mockUserModel,
				},
			],
		}).compile();

		service = module.get<PrivateChatService>(PrivateChatService);

		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('create', () => {
		it('should create a new conversation and message if conversation does not exist', async () => {
			const senderId = new Types.ObjectId().toHexString();
			const recipientId = new Types.ObjectId().toHexString();
			const dto = { id: recipientId, content: 'Hello' };

			mockUserModel.findById.mockResolvedValueOnce({ username: 'Sender' });
			mockConversationModel.findOne.mockResolvedValueOnce(null);

			const fakeConversation = {
				_id: new Types.ObjectId(),
				participants: [senderId, recipientId],
				type: 'dm',
			};
			mockConversationModel.create.mockResolvedValueOnce(fakeConversation);

			const fakeMessage = {
				_id: new Types.ObjectId(),
				content: dto.content,
				sender: senderId,
				conversation: fakeConversation._id,
			};
			mockPrivateMessageModel.create.mockResolvedValueOnce(fakeMessage);

			const result = await service.create(senderId, dto);

			expect(result.conversation).toEqual(fakeConversation);
			expect(result.message).toEqual({
				_id: fakeMessage._id,
				sender: 'Sender',
				content: dto.content,
			});
			expect(mockConversationModel.create).toHaveBeenCalled();
			expect(mockPrivateMessageModel.create).toHaveBeenCalledWith({
				conversation: fakeConversation._id,
				sender: expect.any(Types.ObjectId),
				content: dto.content,
			});
		});

		it('should throw NotFoundException if user not found', async () => {
			const senderId = new Types.ObjectId().toHexString();
			const recipientId = new Types.ObjectId().toHexString();
			const dto = { id: recipientId, content: 'Hello' };

			mockUserModel.findById.mockResolvedValueOnce(null);

			await expect(service.create(senderId, dto)).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe('update', () => {
		it('should update message if sender is correct', async () => {
			const senderId = new Types.ObjectId().toHexString();
			const messageId = new Types.ObjectId().toHexString();
			const dto = { content: 'Updated message' };

			const fakeMessage: any = {
				_id: messageId,
				sender: new Types.ObjectId(senderId),
				conversation: new Types.ObjectId(),
				content: 'Old content',
				save: jest.fn().mockResolvedValue(true),
			};
			const fakeConversation = { _id: fakeMessage.conversation };
			mockPrivateMessageModel.findById.mockResolvedValueOnce(fakeMessage);
			mockConversationModel.findById.mockResolvedValueOnce(fakeConversation);
			mockUserModel.findById.mockResolvedValueOnce({ username: 'Sender' });

			const result = await service.update(senderId, messageId, dto);

			expect(result.message.content).toBe(dto.content);
			expect(result.message.sender).toBe('Sender');
			expect(fakeMessage.save).toHaveBeenCalled();
		});

		it('should throw ForbiddenException if sender is not the owner', async () => {
			const senderId = new Types.ObjectId().toHexString();
			const messageId = new Types.ObjectId().toHexString();

			const fakeMessage: any = {
				_id: messageId,
				sender: new Types.ObjectId(), // different from senderId
				conversation: new Types.ObjectId(),
				content: 'Old content',
				save: jest.fn(),
			};

			const fakeConversation = { _id: fakeMessage.conversation };

			mockPrivateMessageModel.findById.mockResolvedValueOnce(fakeMessage);
			mockConversationModel.findById.mockResolvedValueOnce(fakeConversation);
			mockUserModel.findById.mockResolvedValueOnce({ username: 'Sender' });

			await expect(
				service.update(senderId, messageId, { content: 'New' }),
			).rejects.toThrow(ForbiddenException);
		});

		it('should throw BadRequestException if content is empty', async () => {
			const senderId = new Types.ObjectId().toHexString();
			const messageId = new Types.ObjectId().toHexString();
			const dto = { content: '' };

			const fakeMessage: any = {
				_id: messageId,
				sender: new Types.ObjectId(senderId),
				conversation: new Types.ObjectId(),
				content: 'Old content',
				save: jest.fn(),
			};
			const fakeConversation = { _id: fakeMessage.conversation };

			mockPrivateMessageModel.findById.mockResolvedValueOnce(fakeMessage);
			mockConversationModel.findById.mockResolvedValueOnce(fakeConversation);
			mockUserModel.findById.mockResolvedValueOnce({ username: 'Sender' });

			await expect(service.update(senderId, messageId, dto)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('remove', () => {
		it('should delete message if sender is correct', async () => {
			const senderId = new Types.ObjectId().toHexString();
			const messageId = new Types.ObjectId().toHexString();

			const fakeMessage: any = {
				_id: messageId,
				sender: new Types.ObjectId(senderId),
				conversation: new Types.ObjectId(),
				modification: '',
				save: jest.fn().mockResolvedValue(true),
			};

			const deleteResult = {
				_id: fakeMessage._id,
				sender: 'Sender',
				content: fakeMessage.content,
				modification: 'Deleted',
			};

			const fakeConversation = { _id: fakeMessage.conversation };

			mockPrivateMessageModel.findById.mockResolvedValueOnce(fakeMessage);
			mockConversationModel.findById.mockResolvedValueOnce(fakeConversation);
			mockUserModel.findById.mockResolvedValueOnce({ username: 'Sender' });

			const result = await service.remove(senderId, messageId);

			expect(result.message).toStrictEqual(deleteResult);
			expect(result.message.modification).toBe('Deleted');
			expect(fakeMessage.save).toHaveBeenCalled();
		});

		it('should throw ForbiddenException if sender is not the owner', async () => {
			const senderId = new Types.ObjectId().toHexString();
			const messageId = new Types.ObjectId().toHexString();

			const fakeMessage: any = {
				_id: messageId,
				sender: new Types.ObjectId(), // different from senderId
				conversation: new Types.ObjectId(),
				modification: '',
				save: jest.fn(),
			};

			const fakeConversation = { _id: fakeMessage.conversation };

			mockPrivateMessageModel.findById.mockResolvedValueOnce(fakeMessage);
			mockConversationModel.findById.mockResolvedValueOnce(fakeConversation);
			mockUserModel.findById.mockResolvedValueOnce({ username: 'Sender' });

			await expect(service.remove(senderId, messageId)).rejects.toThrow(
				ForbiddenException,
			);
		});
	});

	describe('findAll', () => {
		it('should return paginated messages', async () => {
			const senderId = new Types.ObjectId().toHexString();
			const recipientId = new Types.ObjectId().toHexString();

			const fakeConversation = { _id: new Types.ObjectId() };
			const fakeMessages = [
				{
					_id: new Types.ObjectId(),
					content: 'Hi',
					sender: { username: 'Sender' },
				},
			];
			mockConversationModel.findOne.mockResolvedValueOnce(fakeConversation);
			mockPrivateMessageModel.lean.mockResolvedValueOnce(fakeMessages);
			mockPrivateMessageModel.countDocuments.mockResolvedValueOnce(1);
			mockUserModel.findById.mockResolvedValueOnce({ username: 'Sender' });

			const result = await service.findAll(senderId, recipientId);

			expect(result.data).toEqual([
				{
					_id: expect.any(Types.ObjectId),
					content: 'Hi',
					sender: 'Sender',
				},
			]);
			expect(result.total).toBe(1);
			expect(result.page).toBe(1);
			expect(result.totalPages).toBe(1);
		});

		it('should throw NotFoundException if conversation not found', async () => {
			const senderId = new Types.ObjectId().toHexString();
			const recipientId = new Types.ObjectId().toHexString();

			mockConversationModel.findOne.mockResolvedValueOnce(null);

			await expect(service.findAll(senderId, recipientId)).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});
