import { Test, TestingModule } from '@nestjs/testing';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';

describe('FollowController', () => {
	let controller: FollowController;
	let service: jest.Mocked<FollowService>;

	const mockUserId = new Types.ObjectId().toHexString();
	const mockOtherUserId = new Types.ObjectId().toHexString();

	const mockedService = {
		followUser: jest.fn(),
		unfollowUser: jest.fn(),
		isFollowing: jest.fn(),
		getFollowers: jest.fn(),
		getFollowing: jest.fn(),
		getFriends: jest.fn(),
	};

	const mockJwtService = {
		signAsync: jest.fn(),
		verifyAsync: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [FollowController],
			providers: [
				{
					provide: FollowService,
					useValue: mockedService,
				},
				{ provide: JwtService, useValue: mockJwtService },
			],
		}).compile();

		controller = module.get<FollowController>(FollowController);
		service = module.get(FollowService);

		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('follow', () => {
		it('should call service.followUser with correct args', async () => {
			service.followUser.mockResolvedValue({ success: true });

			const req: any = { user: { _id: mockUserId } };
			const body = { id: mockOtherUserId };

			const result = await controller.follow(req, body);
			expect(result).toEqual({ success: true });
			expect(service.followUser).toHaveBeenCalledWith(
				mockUserId,
				mockOtherUserId,
			);
		});
	});

	describe('unfollow', () => {
		it('should call service.unfollowUser with correct args', async () => {
			service.unfollowUser.mockResolvedValue({ success: true });

			const req: any = { user: { _id: mockUserId } };
			const userId = mockOtherUserId;

			const result = await controller.unfollow(req, userId);
			expect(result).toEqual({ success: true });
			expect(service.unfollowUser).toHaveBeenCalledWith(mockUserId, userId);
		});
	});

	describe('getFollowers', () => {
		it('should call service.getFollowers with correct args', async () => {
			const mockData = { data: [], page: 1, size: 10, total: 0, totalPages: 0 };
			service.getFollowers.mockResolvedValue(mockData);

			const page = '2';
			const size = '5';
			const userId = mockOtherUserId;
			const req = { user: { _id: mockUserId } } as any;

			const result = await controller.getFollowers(userId, req, page, size);
			expect(result).toEqual(mockData);
			expect(service.getFollowers).toHaveBeenCalledWith(
				userId,
				mockUserId,
				2,
				5,
			);
		});
	});

	describe('getFollowing', () => {
		it('should call service.getFollowing with correct args', async () => {
			const mockData = { data: [], page: 1, size: 10, total: 0, totalPages: 0 };
			service.getFollowing.mockResolvedValue(mockData);

			const page = '1';
			const size = '10';
			const userId = mockOtherUserId;

			const result = await controller.getFollowing(userId, page, size);
			expect(result).toEqual(mockData);
			expect(service.getFollowing).toHaveBeenCalledWith(userId, 1, 10);
		});
	});

	describe('getMyFollowers', () => {
		it('should call service.getFollowers with req.user._id', async () => {
			const mockData = { data: [], page: 1, size: 10, total: 0, totalPages: 0 };
			service.getFollowers.mockResolvedValue(mockData);

			const req: any = { user: { _id: mockUserId } };
			const page = '1';
			const size = '10';

			const result = await controller.getMyFollowers(req, page, size);
			expect(result).toEqual(mockData);
			expect(service.getFollowers).toHaveBeenCalledWith(
				mockUserId,
				mockUserId,
				1,
				10,
			);
		});
	});

	describe('getMyFollowing', () => {
		it('should call service.getFollowing with req.user._id', async () => {
			const mockData = { data: [], page: 1, size: 10, total: 0, totalPages: 0 };
			service.getFollowing.mockResolvedValue(mockData);

			const req: any = { user: { _id: mockUserId } };
			const page = '2';
			const size = '5';

			const result = await controller.getMyFollowing(req, page, size);
			expect(result).toEqual(mockData);
			expect(service.getFollowing).toHaveBeenCalledWith(mockUserId, 2, 5);
		});
	});

	describe('getMyFriends', () => {
		it('should call service.getFollowing with req.user._id', async () => {
			const mockData = {
				friends: [],
				currentPage: 1,
				totalPages: 1,
				totalFriends: 0,
			};
			service.getFriends.mockResolvedValue(mockData);

			const req: any = { user: { _id: mockUserId } };
			const page = '2';
			const size = '5';

			const result = await controller.getFriends(req, page, size);
			expect(result).toEqual(mockData);
			expect(service.getFriends).toHaveBeenCalledWith(mockUserId, 2, 5);
		});
	});
});
