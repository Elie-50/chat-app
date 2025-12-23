import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from '@nestjs/common';

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
		populate: jest.fn(),
	};

	const mockUserModel = {
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
				{
					provide: getModelToken('User'),
					useValue: mockUserModel,
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
				type: 'group',
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
				type: 'group',
			});
			expect(mockQuery.sort).toHaveBeenCalledWith({ updatedAt: -1 });
			expect(mockQuery.skip).toHaveBeenCalledWith(0);
			expect(mockQuery.limit).toHaveBeenCalledWith(50);
		});
	});

	describe('findOne', () => {
		it('should return conversation if found', async () => {
			const mockConversation = {
				_id: mockConversationId,
				populate: jest.fn().mockResolvedValue(undefined),
			};

			conversationModel.findById.mockResolvedValue(mockConversation as any);

			const result = await service.findOne(mockConversationId);

			expect(conversationModel.findById).toHaveBeenCalledWith(
				new Types.ObjectId(mockConversationId),
			);
			expect(mockConversation.populate).toHaveBeenCalledWith({
				path: 'participants',
				select: 'username',
			});
			expect(result).toEqual(mockConversation);
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

	describe('addMember', () => {
		it('should add a member to the conversation if everything is correct', async () => {
			const currentUserId = new Types.ObjectId();
			const memberId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const memberObjId = new Types.ObjectId(memberId);
			const conversationObjId = new Types.ObjectId(conversationId);

			const mockConversation = {
				_id: conversationObjId,
				admin: currentUserId,
				participants: [],
				save: jest.fn(),
			};

			const mockMember = { _id: memberObjId };

			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockUserModel.findById.mockResolvedValue(mockMember);

			await service.addMember(
				memberId.toString(),
				currentUserId.toString(),
				conversationId.toString(),
			);

			expect(mockConversationModel.findById).toHaveBeenCalledWith(
				conversationObjId,
			);
			expect(mockUserModel.findById).toHaveBeenCalledWith(memberObjId);
			expect(
				mockConversation.participants.map((id: Types.ObjectId) =>
					id.toString(),
				),
			).toContain(memberObjId.toString());
			expect(mockConversation.save).toHaveBeenCalled();
		});

		it('should throw NotFoundException if the conversation is not found', async () => {
			const currentUserId = new Types.ObjectId();
			const memberId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();

			mockConversationModel.findById.mockResolvedValue(null);

			await expect(
				service.addMember(
					memberId.toString(),
					currentUserId.toString(),
					conversationId.toString(),
				),
			).rejects.toThrow(new NotFoundException('Conversation not found'));
		});

		it('should throw NotFoundException if the member is not found', async () => {
			const currentUserId = new Types.ObjectId();
			const memberId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const mockConversation = {
				_id: conversationId,
				admin: currentUserId,
				participants: [],
				save: jest.fn(),
			};

			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockUserModel.findById.mockResolvedValue(null);

			await expect(
				service.addMember(
					memberId.toString(),
					currentUserId.toString(),
					conversationId.toString(),
				),
			).rejects.toThrow(new NotFoundException('Member not found'));
		});

		it('should throw ForbiddenException if the current user is not an admin', async () => {
			const currentUserId = new Types.ObjectId();
			const memberId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const mockConversation = {
				_id: conversationId,
				admin: new Types.ObjectId(), // different admin ID
				participants: [],
				save: jest.fn(),
			};

			const mockMember = { _id: memberId };

			mockConversationModel.findById.mockResolvedValue(mockConversation);
			mockUserModel.findById.mockResolvedValue(mockMember);

			await expect(
				service.addMember(
					memberId.toString(),
					currentUserId.toString(),
					conversationId.toString(),
				),
			).rejects.toThrow(
				new ForbiddenException(
					'You are not allowed to add members to this chat',
				),
			);
		});

		it('should throw BadRequestException if the member is already in the group', async () => {
			const currentUserId = new Types.ObjectId();
			const memberId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const memberObjId = new Types.ObjectId(memberId);
			const mockConversation = {
				_id: conversationId,
				admin: currentUserId,
				participants: [memberObjId], // member already in the conversation
				save: jest.fn(),
			};

			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await expect(
				service.addMember(
					memberId.toString(),
					currentUserId.toString(),
					conversationId.toString(),
				),
			).rejects.toThrow(new BadRequestException('User already in group'));
		});
	});

	describe('removeMember', () => {
		it('should remove a member from the conversation if everything is correct', async () => {
			const currentUserId = new Types.ObjectId();
			const memberId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const memberObjId = new Types.ObjectId(memberId);
			const conversationObjId = new Types.ObjectId(conversationId);

			const mockConversation = {
				_id: conversationObjId,
				admin: currentUserId,
				participants: [memberObjId],
				save: jest.fn(),
			};

			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await service.removeMember(
				memberId.toString(),
				currentUserId.toString(),
				conversationId.toString(),
			);

			expect(mockConversationModel.findById).toHaveBeenCalledWith(
				conversationId.toString(),
			);
			expect(mockConversation.participants).not.toContain(memberObjId);
			expect(mockConversation.save).toHaveBeenCalled();
		});

		it('should throw NotFoundException if the conversation is not found', async () => {
			const currentUserId = new Types.ObjectId();
			const memberId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();

			mockConversationModel.findById.mockResolvedValue(null);

			await expect(
				service.removeMember(
					memberId.toString(),
					currentUserId.toString(),
					conversationId.toString(),
				),
			).rejects.toThrow(new NotFoundException('Conversation not found'));
		});

		it('should throw BadRequestException if the member is not in the conversation', async () => {
			const currentUserId = new Types.ObjectId();
			const memberId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const mockConversation = {
				_id: conversationId,
				admin: currentUserId,
				participants: [], // member not in conversation
				save: jest.fn(),
			};

			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await expect(
				service.removeMember(
					memberId.toString(),
					currentUserId.toString(),
					conversationId.toString(),
				),
			).rejects.toThrow(
				new BadRequestException('User is not in this conversation'),
			);
		});

		it('should throw ForbiddenException if the current user is not an admin or the member themselves', async () => {
			const currentUserId = new Types.ObjectId(); // A non-admin user
			const memberId = new Types.ObjectId(); // The member to be removed
			const conversationId = new Types.ObjectId();
			const mockConversation = {
				_id: conversationId,
				admin: new Types.ObjectId('60d5f5b5f7f8d24b984e9d10'), // admin with a different ID
				participants: [memberId],
				save: jest.fn(),
			};

			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await expect(
				service.removeMember(
					memberId.toString(),
					currentUserId.toString(),
					conversationId.toString(),
				),
			).rejects.toThrow(
				new ForbiddenException('You are not allowed to remove this member'),
			);
		});

		it('should throw BadRequestException if trying to remove an admin from the conversation', async () => {
			const currentUserId = new Types.ObjectId();
			const adminId = currentUserId; // Admin trying to remove themselves
			const conversationId = new Types.ObjectId();
			const mockConversation = {
				_id: conversationId,
				admin: currentUserId,
				participants: [adminId],
				save: jest.fn(),
			};

			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await expect(
				service.removeMember(
					adminId.toString(),
					currentUserId.toString(),
					conversationId.toString(),
				),
			).rejects.toThrow(
				new BadRequestException('Admin cannot be removed from the group'),
			);
		});

		it('should allow a user to remove themselves from the conversation', async () => {
			const currentUserId = new Types.ObjectId();
			const memberId = currentUserId;
			const adminId = new Types.ObjectId();
			const conversationId = new Types.ObjectId();
			const mockConversation = {
				_id: conversationId,
				admin: adminId,
				participants: [memberId],
				save: jest.fn(),
			};

			mockConversationModel.findById.mockResolvedValue(mockConversation);

			await service.removeMember(
				memberId.toString(),
				currentUserId.toString(),
				conversationId.toString(),
			);

			expect(mockConversationModel.findById).toHaveBeenCalledWith(
				conversationId.toString(),
			);
			expect(mockConversation.participants).not.toContain(memberId);
			expect(mockConversation.save).toHaveBeenCalled();
		});
	});
});
