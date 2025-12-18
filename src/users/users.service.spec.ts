import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { UsersService } from './users.service';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
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

const mockedUser: CreateUserDto = {
	email: 'user@example.com',
	verificationCode: '123456',
	verificationDue: new Date(Date.now() + 2 * 3600 * 1000),
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

			const email = 'user@example.com';
			const result = await service.create(email);

			expect(result).toEqual(mockedUser);
			expect(model.create).toHaveBeenCalledWith({ email });
		});
	});

	describe('findOneWithEmail', () => {
		it('should return one user', async () => {
			model.findOne.mockReturnValueOnce({
				exec: jest.fn().mockResolvedValueOnce(mockedUser),
			} as any);

			const email = 'email@example.com';
			const result = await service.findOneWithEmail(email);

			expect(result).toEqual(mockedUser);
			expect(model.findOne).toHaveBeenCalledWith({ email: email });
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

	describe('findByEmailAndVerify', () => {
		it('should verify user and clear verificationCode', async () => {
			const id = new Types.ObjectId().toString();
			const userMock = {
				_id: id,
				...mockedUser,
				save: jest.fn().mockResolvedValueOnce(true),
			};

			model.findOne.mockResolvedValueOnce(userMock as any);

			const result = await service.findByEmailAndVerify(
				mockedUser.email,
				mockedUser.verificationCode,
			);

			expect(model.findOne).toHaveBeenCalledWith({
				email: mockedUser.email,
				verificationCode: mockedUser.verificationCode,
			});

			expect(userMock.verificationCode).toBe('');
			expect(userMock.save).toHaveBeenCalled();

			const res = {
				_id: id,
				email: mockedUser.email,
				username: undefined,
			};

			expect(result).toEqual(res);
		});

		it('should throw BadRequestException for invalid code', async () => {
			model.findOne.mockResolvedValueOnce(null);

			await expect(
				service.findByEmailAndVerify('a@b.com', '000000'),
			).rejects.toThrow('Invalid verification code');

			expect(model.findOne).toHaveBeenCalledWith({
				email: 'a@b.com',
				verificationCode: '000000',
			});
		});

		it('should throw if verification code is expired', async () => {
			const expiredUser = {
				_id: 'someId',
				email: 'test@example.com',
				verificationCode: '123456',
				verificationDue: new Date(Date.now() - 3 * 3600 * 1000), // 3 hours ago
				save: jest.fn(),
			} as any;

			model.findOne.mockResolvedValueOnce(expiredUser);

			await expect(
				service.findByEmailAndVerify(
					expiredUser.email,
					expiredUser.verificationCode,
				),
			).rejects.toThrow('Verification code has expired');
		});
	});

	describe('findOrCreate', () => {
		it('should return existing user and update verification fields', async () => {
			const existingUser = {
				...mockedUser,
				save: jest.fn(),
			};

			jest
				.spyOn(service, 'findOneWithEmail')
				.mockResolvedValueOnce(existingUser as any);

			jest
				.spyOn<any, any>(service as any, 'generateRandomSixDigitNumber')
				.mockReturnValue('111111');

			const beforeCall = Date.now();

			const result = await service.findOrCreate(existingUser.email);

			expect(service.findOneWithEmail).toHaveBeenCalledWith(existingUser.email);

			// create should NOT be called
			expect(model.create).not.toHaveBeenCalled();

			// verification fields updated
			expect(existingUser.verificationCode).toBe('111111');
			expect(existingUser.verificationDue.getTime()).toBeGreaterThan(
				beforeCall,
			);

			// save must be called
			expect(existingUser.save).toHaveBeenCalled();

			expect(result).toBe(existingUser);
		});

		it('should create a new user when none exists', async () => {
			jest.spyOn(service, 'findOneWithEmail').mockResolvedValueOnce(null);

			const createdUser = {
				...mockedUser,
				save: jest.fn(),
			} as unknown as UserDocument;

			model.create.mockResolvedValueOnce(createdUser as any);

			jest
				.spyOn<any, any>(service as any, 'generateRandomSixDigitNumber')
				.mockReturnValue('111111');

			const beforeCall = Date.now();
			const result = await service.findOrCreate(mockedUser.email);

			expect(service.findOneWithEmail).toHaveBeenCalledWith(mockedUser.email);

			expect(model.create).toHaveBeenCalledWith({ email: mockedUser.email });

			expect(createdUser.verificationCode).toBe('111111');
			expect(createdUser.verificationDue!.getTime()).toBeGreaterThan(
				beforeCall,
			);

			expect(createdUser.save).toHaveBeenCalled();

			expect(result).toEqual(createdUser);
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
