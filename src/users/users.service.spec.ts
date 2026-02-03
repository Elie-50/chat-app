import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { JwtService } from '@nestjs/jwt';

const modelMock = {
	create: jest.fn(),
	findOne: jest.fn(),
	findByIdAndUpdate: jest.fn(),
	findByIdAndDelete: jest.fn(),
	aggregate: jest.fn(),
	countDocuments: jest.fn(),
};

describe('UsersService', () => {
	let service: UsersService;
	let model: jest.Mocked<Model<User>>;

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UsersService,
				{
					provide: getModelToken(User.name),
					useValue: modelMock,
				},
				{
					provide: JwtService,
					useValue: {
						verifyAsync: jest.fn(),
						signAsync: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<UsersService>(UsersService);
		model = module.get(getModelToken('User'));
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('searchByUsername', () => {
		it('should return empty pagination result when username is empty', async () => {
			const result = await service.searchByUsername('', 1, 10, 'userId');

			expect(result).toEqual({
				data: [],
				page: 1,
				size: 10,
				total: 0,
				totalPages: 0,
			});

			expect(model.aggregate).not.toHaveBeenCalled();
			expect(model.countDocuments).not.toHaveBeenCalled();
		});

		it('should return users with isFollowing flag and correct pagination', async () => {
			const currentUserId = new Types.ObjectId().toHexString();

			const mockUsers = [
				{ _id: new Types.ObjectId(), username: 'alice', isFollowing: true },
				{ _id: new Types.ObjectId(), username: 'alex', isFollowing: false },
			];

			model.aggregate.mockResolvedValue(mockUsers);
			model.countDocuments.mockResolvedValue(2);

			const result = await service.searchByUsername('al', 1, 10, currentUserId);

			expect(result).toEqual({
				data: mockUsers,
				page: 1,
				size: 10,
				total: 2,
				totalPages: 1,
			});
		});

		it('should build correct aggregation pipeline', async () => {
			const currentUserId = new Types.ObjectId().toHexString();

			model.aggregate.mockResolvedValue([]);
			model.countDocuments.mockResolvedValue(0);

			await service.searchByUsername('john', 2, 5, currentUserId);

			expect(model.aggregate).toHaveBeenCalledTimes(1);

			const pipeline = model.aggregate.mock.calls[0][0];

			// $match
			expect(pipeline[0]).toEqual({
				$match: {
					username: { $regex: 'john', $options: 'i' },
					_id: { $ne: new Types.ObjectId(currentUserId) },
				},
			});

			// $lookup
			expect(pipeline[1]).toMatchObject({
				$lookup: {
					from: 'follows',
					as: 'followRelation',
				},
			});

			// $addFields
			expect(pipeline[2]).toEqual({
				$addFields: {
					isFollowing: { $gt: [{ $size: '$followRelation' }, 0] },
				},
			});

			// $project
			expect(pipeline[3]).toEqual({
				$project: {
					username: 1,
					isFollowing: 1,
					isOnline: 1,
					lastSeen: 1,
				},
			});

			// pagination
			expect(pipeline[4]).toEqual({ $skip: 5 }); // (page 2 - 1) * 5
			expect(pipeline[5]).toEqual({ $limit: 5 });
		});

		it('should cap page size at 50', async () => {
			model.aggregate.mockResolvedValue([]);
			model.countDocuments.mockResolvedValue(0);

			const result = await service.searchByUsername(
				'test',
				1,
				100,
				new Types.ObjectId().toHexString(),
			);

			expect(result.size).toBe(50);
		});
	});
});
