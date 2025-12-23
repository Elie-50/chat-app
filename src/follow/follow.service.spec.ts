import { Test, TestingModule } from '@nestjs/testing';
import { FollowService } from './follow.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Follow } from './schemas/follow.schema';
import { User } from '../users/schemas/user.schema';

describe('FollowService', () => {
	let service: FollowService;
	let followModel: jest.Mocked<Model<Follow>>;
	let userModel: jest.Mocked<Model<User>>;

	const mockFollowModel = {
		create: jest.fn(),
		findOne: jest.fn(),
		findByIdAndDelete: jest.fn(),
		exists: jest.fn(),
		find: jest.fn().mockReturnThis(),
		sort: jest.fn().mockReturnThis(),
		skip: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		populate: jest.fn().mockReturnThis(),
		lean: jest.fn().mockReturnThis(),
		countDocuments: jest.fn(),
	};

	const mockUserModel = {
		findById: jest.fn(),
	};

	const followerId = new Types.ObjectId().toHexString();
	const followingId = new Types.ObjectId().toHexString();

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FollowService,
				{
					provide: getModelToken('Follow'),
					useValue: mockFollowModel,
				},
				{
					provide: getModelToken('User'),
					useValue: mockUserModel,
				},
			],
		}).compile();

		service = module.get<FollowService>(FollowService);
		followModel = module.get(getModelToken('Follow'));
		userModel = module.get(getModelToken('User'));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('followUser', () => {
		it('should throw if followerId equals followingId', async () => {
			await expect(service.followUser(followerId, followerId)).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should throw if user not found', async () => {
			userModel.findById.mockResolvedValue(null);

			await expect(service.followUser(followerId, followingId)).rejects.toThrow(
				NotFoundException,
			);
		});

		it('should throw if already following (duplicate key error)', async () => {
			userModel.findById.mockResolvedValue({ _id: followingId });
			const err = new MongoServerError({} as any);
			err.code = 11000;
			followModel.create.mockRejectedValue(err);

			await expect(service.followUser(followerId, followingId)).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should create follow successfully', async () => {
			userModel.findById.mockResolvedValue({ _id: followingId });
			followModel.create.mockResolvedValue({
				_id: new Types.ObjectId(),
			} as any);

			const result = await service.followUser(followerId, followingId);
			expect(result).toEqual({ success: true });
			expect(followModel.create).toHaveBeenCalledWith({
				follower: new Types.ObjectId(followerId),
				following: new Types.ObjectId(followingId),
			});
		});
	});

	describe('unfollowUser', () => {
		it('should delete follow and return success', async () => {
			const _id = new Types.ObjectId();

			followModel.findOne.mockResolvedValue({
				_id,
			} as any);

			followModel.findByIdAndDelete.mockResolvedValue(null);

			const result = await service.unfollowUser(followerId, followingId);

			expect(result).toEqual({ success: true });

			expect(followModel.findOne).toHaveBeenCalledWith({
				follower: new Types.ObjectId(followerId),
				following: new Types.ObjectId(followingId),
			});

			expect(followModel.findByIdAndDelete).toHaveBeenCalledWith(_id);
		});
	});

	describe('getFollowers', () => {
		it('should return paginated followers with isFollowing', async () => {
			const mockAggResult = [
				{ _id: '1', username: 'Alice', isFollowing: true },
				{ _id: '2', username: 'Bob', isFollowing: false },
			];

			followModel.aggregate = jest.fn().mockResolvedValue(mockAggResult);

			followModel.countDocuments = jest.fn().mockResolvedValue(2);

			const userId = new Types.ObjectId().toString();
			const currentUserId = new Types.ObjectId().toString();

			const result = await service.getFollowers(userId, currentUserId, 1, 10);

			expect(followModel.aggregate).toHaveBeenCalled();
			expect(result.data).toEqual(mockAggResult);
			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
			expect(result.size).toBe(10);
			expect(result.totalPages).toBe(1);
		});
	});

	describe('getFollowing', () => {
		it('should return paginated following', async () => {
			const mockData = [
				{ following: { _id: '3', username: 'Charlie' } },
				{ following: { _id: '4', username: 'Dave' } },
			];
			followModel.find.mockReturnValue({
				sort: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				limit: jest.fn().mockReturnThis(),
				populate: jest.fn().mockReturnThis(),
				lean: jest.fn().mockResolvedValue(mockData),
			} as any);

			followModel.countDocuments.mockResolvedValue(2);

			const result = await service.getFollowing(followerId, 1, 10);
			expect(result.data).toEqual([
				{ _id: '3', username: 'Charlie' },
				{ _id: '4', username: 'Dave' },
			]);
			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
			expect(result.size).toBe(10);
			expect(result.totalPages).toBe(1);
		});
	});

	describe('getFriends', () => {
		const userId = new Types.ObjectId().toString();
		it('should return paginated friends with total count', async () => {
			const mockFriends = [
				{ _id: '1', username: 'Alice' },
				{ _id: '2', username: 'Bob' },
			];

			const mockCountResult = [{ total: 2 }];

			// Mock aggregate for count
			const aggregateMock = jest
				.fn()
				.mockImplementationOnce(() => ({
					exec: jest.fn().mockResolvedValue(mockCountResult),
				}))
				// Mock aggregate for paginated results
				.mockImplementationOnce(() => ({
					exec: jest.fn().mockResolvedValue(mockFriends),
				}));

			// Assign the mock to followModel.aggregate
			followModel.aggregate = aggregateMock as any;

			const page = 1;
			const size = 10;

			const result = await service.getFriends(userId, page, size);

			// Check aggregate was called twice (count + paginated)
			expect(aggregateMock).toHaveBeenCalledTimes(2);

			// Check result
			expect(result).toEqual({
				totalFriends: 2,
				totalPages: 1,
				currentPage: page,
				friends: mockFriends,
			});
		});

		it('should return empty array if no friends', async () => {
			const mockCountResult: any[] = [];
			const mockFriends: any[] = [];

			const aggregateMock = jest
				.fn()
				.mockImplementationOnce(() => ({
					exec: jest.fn().mockResolvedValue(mockCountResult),
				}))
				.mockImplementationOnce(() => ({
					exec: jest.fn().mockResolvedValue(mockFriends),
				}));

			followModel.aggregate = aggregateMock as any;

			const result = await service.getFriends(userId, 1, 10);

			expect(result).toEqual({
				totalFriends: 0,
				totalPages: 0,
				currentPage: 1,
				friends: [],
			});
		});
	});
});
