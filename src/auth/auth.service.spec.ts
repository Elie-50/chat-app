import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

describe('AuthService', () => {
	let service: AuthService;
	let usersService: jest.Mocked<UsersService>;
	let jwtService: jest.Mocked<JwtService>;

	const mockUsersService = {
		findOrCreate: jest.fn(),
		findByEmailAndVerify: jest.fn(),
		update: jest.fn(),
		findOne: jest.fn(),
	};

	const mockJwtService = {
		signAsync: jest.fn(),
		verifyAsync: jest.fn(),
	};

	const mockUser = {
		_id: { toString: () => 'user-id-123' },
		email: 'test@example.com',
		username: 'tester',
		verificationCode: '123456',
		verificationDue: new Date(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: UsersService, useValue: mockUsersService },
				{ provide: JwtService, useValue: mockJwtService },
			],
		}).compile();

		service = module.get(AuthService);
		usersService = module.get(UsersService);
		jwtService = module.get(JwtService);
	});

	describe('refreshTokens', () => {
		it('should verify refresh token, rotate, and return new access token', async () => {
			const req = {
				cookies: { refresh_token: 'old-refresh' },
			} as unknown as Request;
			const res = { cookie: jest.fn() } as unknown as Response;

			usersService.findOne.mockReturnValue(mockUser as any);

			jwtService.verifyAsync.mockResolvedValueOnce({
				_id: 'user-id-123',
				email: 'test@example.com',
				iat: 123,
				exp: 456,
			});

			jwtService.signAsync
				.mockResolvedValueOnce('new-access-token')
				.mockResolvedValueOnce('new-refresh-token');

			const result = await service.refreshTokens(req, res);

			expect(jwtService.verifyAsync).toHaveBeenCalledWith('old-refresh', {
				secret: process.env.JWT_REFRESH_SECRET,
			});
			expect(res.cookie).toHaveBeenCalledWith(
				'refresh_token',
				'new-refresh-token',
				expect.any(Object),
			);
			expect(result).toEqual({
				accessToken: 'new-access-token',
				user: {
					_id: 'user-id-123',
					email: 'test@example.com',
					username: mockUser.username,
				},
			});
		});

		it('should throw UnauthorizedException if no cookie', async () => {
			const req = { cookies: {} } as unknown as Request;
			const res = {} as unknown as Response;

			await expect(service.refreshTokens(req, res)).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it('should throw UnauthorizedException if token invalid', async () => {
			const req = {
				cookies: { refresh_token: 'bad-token' },
			} as unknown as Request;
			const res = {} as unknown as Response;

			jwtService.verifyAsync.mockRejectedValueOnce(new Error('bad token'));

			await expect(service.refreshTokens(req, res)).rejects.toThrow(
				UnauthorizedException,
			);
		});
	});

	describe('logout', () => {
		it('should clear cookie and return success message', () => {
			const res = { clearCookie: jest.fn() } as unknown as Response;

			const result = service.logout(res);

			expect(res.clearCookie).toHaveBeenCalledWith(
				'refresh_token',
				expect.any(Object),
			);
			expect(result).toEqual({ message: 'Logged out successfully' });
		});
	});

	describe('update', () => {
		it('should update user, generate tokens, set cookie, and return payload + accessToken', async () => {
			const id = 'user-id-123';
			const updateUserDto = { username: 'newName' };
			const updatedUser = {
				_id: { toString: () => id },
				email: 'test@example.com',
				username: 'newName',
			};

			usersService.update.mockResolvedValueOnce(updatedUser as any);
			jwtService.signAsync
				.mockResolvedValueOnce('access-token') // access
				.mockResolvedValueOnce('refresh-token'); // refresh

			const res = { cookie: jest.fn() } as unknown as Response;

			const result = await service.update(id, updateUserDto, res);

			expect(usersService.update).toHaveBeenCalledWith(id, updateUserDto);
			expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
			expect(res.cookie).toHaveBeenCalledWith(
				'refresh_token',
				'refresh-token',
				expect.any(Object),
			);
			expect(result).toEqual({
				user: {
					_id: id,
					username: 'newName',
				},
				accessToken: 'access-token',
			});
		});

		it('should throw NotFoundException if user not found', async () => {
			usersService.update.mockResolvedValueOnce(null as any);
			const res = {} as unknown as Response;

			await expect(service.update('bad-id', {}, res)).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});
