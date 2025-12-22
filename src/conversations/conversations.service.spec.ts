import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ConversationsService', () => {
	let service: ConversationsService;
	let conversationModel: jest.Mocked<Model<Conversation>>;

	const mockConversationModel = {
		create: jest.fn(),
		find: jest.fn().mockReturnThis(),
		sort: jest.fn().mockReturnThis(),
		skip: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		exec: jest.fn(),
		countDocuments: jest.fn(),
		findById: jest.fn(),
	};

	const mockUserId = new Types.ObjectId().toHexString();
	const mockConversationId = new Types.ObjectId().toHexString();

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ConversationsService,
				{
					provide: getModelToken(Conversation.name),
					useValue: mockConversationModel,
				},
			],
		}).compile();

		service = module.get<ConversationsService>(ConversationsService);
		conversationModel = module.get(getModelToken(Conversation.name));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('create', () => {
		it('should create a group conversation', async () => {
			const mockConversation = { _id: mockConversationId };

			conversationModel.create.mockResolvedValue(mockConversation as any);

			const result = await service.create(mockUserId, 'Test group');

			expect(result).toEqual(mockConversation);
			expect(conversationModel.create).toHaveBeenCalledWith({
				admin: new Types.ObjectId(mockUserId),
				participants: [new Types.ObjectId(mockUserId)],
				name: 'Test group',
				type: 'group',
			});
		});
	});

	describe('findAll', () => {
		it('should return paginated conversations', async () => {
			const mockData = [{ _id: '1' }, { _id: '2' }];

			const mockQuery = {
				sort: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				exec: jest.fn().mockResolvedValue(mockData),
			};

			conversationModel.find.mockReturnValue(mockQuery as any);
			conversationModel.countDocuments.mockResolvedValue(2);

			const result = await service.findAll(mockUserId, 1, 10);

			expect(result.data).toEqual(mockData);
			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
			expect(result.size).toBe(10);
			expect(result.totalPages).toBe(1);

			expect(conversationModel.find).toHaveBeenCalledWith({
				participants: new Types.ObjectId(mockUserId),
			});
			expect(mockQuery.sort).toHaveBeenCalledWith({ updatedAt: -1 });
			expect(mockQuery.skip).toHaveBeenCalledWith(0);
			expect(mockQuery.limit).toHaveBeenCalledWith(10);
		});

		it('should limit at 50', async () => {
			const mockData = [{ _id: '1' }, { _id: '2' }];

			const mockQuery = {
				sort: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				exec: jest.fn().mockResolvedValue(mockData),
			};

			conversationModel.find.mockReturnValue(mockQuery as any);
			conversationModel.countDocuments.mockResolvedValue(2);

			const result = await service.findAll(mockUserId, 1, 100);

			expect(result.data).toEqual(mockData);
			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
			expect(result.size).toBe(50);
			expect(result.totalPages).toBe(1);

			expect(conversationModel.find).toHaveBeenCalledWith({
				participants: new Types.ObjectId(mockUserId),
			});
			expect(mockQuery.sort).toHaveBeenCalledWith({ updatedAt: -1 });
			expect(mockQuery.skip).toHaveBeenCalledWith(0);
			expect(mockQuery.limit).toHaveBeenCalledWith(50);
		});
	});

	describe('findOne', () => {
		it('should return conversation if found', async () => {
			const mockConversation = { _id: mockConversationId };

			conversationModel.findById.mockResolvedValue(mockConversation as any);

			const result = await service.findOne(mockConversationId);

			expect(result).toEqual(mockConversation);
			expect(conversationModel.findById).toHaveBeenCalledWith(
				new Types.ObjectId(mockConversationId),
			);
		});

		it('should throw NotFoundException if conversation not found', async () => {
			conversationModel.findById.mockResolvedValue(null);

			await expect(service.findOne(mockConversationId)).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe('update', () => {
		it('should update conversation name if user is admin', async () => {
			const save = jest.fn().mockResolvedValue(true);

			const mockConversation = {
				_id: mockConversationId,
				admin: new Types.ObjectId(mockUserId),
				name: 'Old name',
				save,
			};

			conversationModel.findById.mockResolvedValue(mockConversation as any);

			const result = await service.update(
				mockConversationId,
				mockUserId,
				'New name',
			);

			expect(result.name).toBe('New name');
			expect(save).toHaveBeenCalled();
		});

		it('should throw NotFoundException if conversation not found', async () => {
			conversationModel.findById.mockResolvedValue(null);

			await expect(
				service.update(mockConversationId, mockUserId, 'New name'),
			).rejects.toThrow(NotFoundException);
		});

		it('should throw ForbiddenException if user is not admin', async () => {
			const mockConversation = {
				_id: mockConversationId,
				admin: new Types.ObjectId(),
			};

			conversationModel.findById.mockResolvedValue(mockConversation as any);

			await expect(
				service.update(mockConversationId, mockUserId, 'New name'),
			).rejects.toThrow(ForbiddenException);
		});
	});
});
