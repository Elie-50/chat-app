import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';

describe('UsersController', () => {
	let controller: UsersController;
	let service: jest.Mocked<UsersService>;

	const mockedService = {
		searchByUsername: jest.fn(),
	};

	const mockJwtService = {
		signAsync: jest.fn(),
		verifyAsync: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [UsersController],
			providers: [
				{
					provide: UsersService,
					useValue: mockedService,
				},
				{ provide: JwtService, useValue: mockJwtService },
			],
		}).compile();

		controller = module.get<UsersController>(UsersController);
		service = module.get(UsersService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('searchUsers', () => {
		const userId = new Types.ObjectId();

		const mockReq = {
			user: {
				_id: userId,
			},
		} as any;

		it('should call usersService.searchByUsername with correct args', async () => {
			const mockResult = {
				data: [
					{
						_id: new Types.ObjectId(),
						username: 'alice',
						email: 'alice@example.com',
						verificationCode: '',
						__v: 0,
					},
				],
				page: 2,
				size: 5,
				total: 1,
				totalPages: 1,
			};

			service.searchByUsername.mockResolvedValue(mockResult);

			const username = 'alice';
			const page = '2';
			const size = '5';

			const result = await controller.searchUsers(
				username,
				mockReq,
				page,
				size,
			);

			expect(result).toEqual(mockResult);
			expect(service.searchByUsername).toHaveBeenCalledWith(
				username,
				2,
				5,
				userId,
			);
		});

		it('should use default page and size if not provided', async () => {
			const mockResult = {
				data: [
					{
						_id: new Types.ObjectId(),
						username: 'bob',
						email: 'bob@example.com',
						verificationCode: '',
						__v: 0,
					},
				],
				page: 1,
				size: 10,
				total: 1,
				totalPages: 1,
			};

			service.searchByUsername.mockResolvedValue(mockResult);

			const username = 'bob';

			const result = await controller.searchUsers(username, mockReq);

			expect(result).toEqual(mockResult);
			expect(service.searchByUsername).toHaveBeenCalledWith(
				username,
				1,
				10,
				userId,
			);
		});
	});
});
