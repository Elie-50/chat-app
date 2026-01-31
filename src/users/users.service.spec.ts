import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const modelMock = {
	create: jest.fn(),
	findOne: jest.fn(),
	findByIdAndUpdate: jest.fn(),
	findByIdAndDelete: jest.fn(),
	aggregate: jest.fn(),
	countDocuments: jest.fn(),
};

const mockedUser: User = {
	username: 'username',
	password: 'password',
	isOnline: true,
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

	describe('create', () => {
		it('should insert a new user', async () => {
			model.create.mockResolvedValueOnce(mockedUser as any);

			const result = await service.create(mockedUser);

			expect(result).toEqual(mockedUser);
			expect(model.create).toHaveBeenCalledWith(mockedUser);
		});
	});

	describe('findOneWithUsername', () => {
		it('should return one user', async () => {
			model.findOne.mockReturnValueOnce({
				exec: jest.fn().mockResolvedValueOnce(mockedUser),
			} as any);

			const username = 'username';
			const result = await service.findOneWithUsername(username);

			expect(result).toEqual(mockedUser);
			expect(model.findOne).toHaveBeenCalledWith({ username: username });
		});
	});

	describe('update', () => {
		it('should update a user and return the updated document', async () => {
			const id = new Types.ObjectId().toString();
			const updated = {
				_id: id,
				...mockedUser,
				username: 'username',
			};
			model.findByIdAndUpdate.mockReturnValueOnce({
				exec: jest.fn().mockResolvedValueOnce(updated),
			} as any);

			const updateUserDto = {
				username: 'username',
			};
			const result = await service.update(id, updateUserDto);

			expect(result).toEqual(updated);
			expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
				{ _id: id },
				updateUserDto,
				{ new: true },
			);
		});
	});

	describe('delete', () => {
		it('should delete a user', async () => {
			model.findByIdAndDelete.mockReturnValueOnce({
				exec: jest.fn().mockResolvedValueOnce(mockedUser),
			} as any);

			const id = new Types.ObjectId().toString();
			const result = await service.delete(id);

			expect(result).toEqual(mockedUser);
			expect(model.findByIdAndDelete).toHaveBeenCalledWith({ _id: id });
		});

		it('should throw not found', async () => {
			model.findByIdAndDelete.mockReturnValueOnce({
				exec: jest.fn().mockResolvedValueOnce(null),
			} as any);

			const id = new Types.ObjectId().toString();
			await expect(service.delete(id)).rejects.toThrow(NotFoundException);
			expect(model.findByIdAndDelete).toHaveBeenCalledWith({ _id: id });
		});
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
