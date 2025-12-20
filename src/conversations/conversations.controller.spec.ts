import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';

describe('ConversationsController', () => {
	let controller: ConversationsController;
	let service: jest.Mocked<ConversationsService>;

	const mockUserId = new Types.ObjectId().toHexString();
	const mockConversationId = new Types.ObjectId().toHexString();

	const mockedService = {
		create: jest.fn(),
		findAll: jest.fn(),
		findOne: jest.fn(),
		update: jest.fn(),
	};

	const mockJwtService = {
		signAsync: jest.fn(),
		verifyAsync: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ConversationsController],
			providers: [
				{
					provide: ConversationsService,
					useValue: mockedService,
				},
				{ provide: JwtService, useValue: mockJwtService },
			],
		}).compile();

		controller = module.get<ConversationsController>(ConversationsController);
		service = module.get(ConversationsService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('create', () => {
		it('should call service.create with correct args', async () => {
			const req: any = { user: { _id: mockUserId } };
			const body = { name: 'Test conversation' };

			service.create.mockResolvedValue({ success: true } as any);

			const result = await controller.create(req, body);

			expect(result).toEqual({ success: true });
			expect(service.create).toHaveBeenCalledWith(mockUserId, body.name);
		});
	});

	describe('findAll', () => {
		it('should call service.findAll with correct args', async () => {
			const req: any = { user: { _id: mockUserId } };
			const mockData = {
				data: [],
				page: 2,
				size: 10,
				total: 0,
				totalPages: 0,
			};

			service.findAll.mockResolvedValue(mockData as any);

			const result = await controller.findAll(req, 2, 10);

			expect(result).toEqual(mockData);
			expect(service.findAll).toHaveBeenCalledWith(mockUserId, 2, 10);
		});

		it('should use default pagination values', async () => {
			const req: any = { user: { _id: mockUserId } };

			service.findAll.mockResolvedValue({} as any);

			await controller.findAll(req);

			expect(service.findAll).toHaveBeenCalledWith(mockUserId, 1, 20);
		});
	});

	describe('findOne', () => {
		it('should call service.findOne with correct id', async () => {
			service.findOne.mockResolvedValue({ id: mockConversationId } as any);

			const result = await controller.findOne(mockConversationId);

			expect(result).toEqual({ id: mockConversationId });
			expect(service.findOne).toHaveBeenCalledWith(mockConversationId);
		});
	});

	describe('update', () => {
		it('should call service.update with correct args', async () => {
			const req: any = { user: { _id: mockUserId } };
			const body = { name: 'Updated name' };

			service.update.mockResolvedValue({ success: true } as any);

			const result = await controller.update(req, mockConversationId, body);

			expect(result).toEqual({ success: true });
			expect(service.update).toHaveBeenCalledWith(
				mockConversationId,
				mockUserId,
				body.name,
			);
		});
	});
});
