import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { AuthenticatedRequest } from './auth.guard';
import { JwtService } from '@nestjs/jwt';

describe('AuthController', () => {
	let controller: AuthController;

	const mockAuthService = {
		requestCode: jest.fn(),
		verify: jest.fn(),
		refreshTokens: jest.fn(),
		logout: jest.fn(),
		update: jest.fn(),
	};

	const mockJwtService = {
		signAsync: jest.fn(),
		verifyAsync: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: AuthService,
					useValue: mockAuthService,
				},
				{ provide: JwtService, useValue: mockJwtService },
			],
		}).compile();

		controller = module.get(AuthController);
	});

	describe('requestCode', () => {
		it('should call authService.requestCode and return result', async () => {
			const mockResult = { message: 'Email sent successfully' };
			mockAuthService.requestCode.mockResolvedValueOnce(mockResult);

			const result = await controller.requestCode({
				email: 'test@example.com',
			});

			expect(mockAuthService.requestCode).toHaveBeenCalledWith(
				'test@example.com',
			);
			expect(result).toEqual(mockResult);
		});
	});

	describe('verifyEmail', () => {
		it('should call authService.verify and return user + accessToken', async () => {
			const mockResponse = { cookie: jest.fn() } as unknown as Response;
			const mockResult = {
				user: { _id: '123', email: 'test@example.com' },
				accessToken: 'access-token',
			};
			mockAuthService.verify.mockResolvedValueOnce(mockResult);

			const result = await controller.verifyEmail(
				{ email: 'test@example.com', code: '123456' },
				mockResponse,
			);

			expect(mockAuthService.verify).toHaveBeenCalledWith(
				'test@example.com',
				'123456',
				mockResponse,
			);
			expect(result).toEqual(mockResult);
		});
	});

	describe('refresh', () => {
		it('should call authService.refreshTokens and return result', async () => {
			const mockRequest = {
				cookies: { refresh_token: 'old-refresh' },
			} as unknown as Request;
			const mockResponse = { cookie: jest.fn() } as unknown as Response;
			const mockResult = { accessToken: 'new-access-token' };

			mockAuthService.refreshTokens.mockResolvedValueOnce(mockResult);

			const result = await controller.refresh(mockRequest, mockResponse);

			expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(
				mockRequest,
				mockResponse,
			);
			expect(result).toEqual(mockResult);
		});
	});

	describe('logout', () => {
		it('should call authService.logout and return result', () => {
			const mockResponse = { clearCookie: jest.fn() } as unknown as Response;
			const mockResult = { message: 'Logged out successfully' };

			mockAuthService.logout.mockReturnValueOnce(mockResult);

			const result = controller.logout(mockResponse);

			expect(mockAuthService.logout).toHaveBeenCalledWith(mockResponse);
			expect(result).toEqual(mockResult);
		});
	});

	describe('update', () => {
		it('should call authService.update with user id, dto, and res, and return result', async () => {
			const mockResponse = { cookie: jest.fn() } as unknown as Response;
			const mockRequest = {
				user: { _id: 'user-id-123' },
			} as unknown as AuthenticatedRequest;
			const updateUserDto: UpdateUserDto = { username: 'newName' };

			const mockResult = {
				user: {
					_id: 'user-id-123',
					email: 'test@example.com',
					username: 'newName',
				},
				accessToken: 'access-token',
			};
			mockAuthService.update.mockResolvedValueOnce(mockResult);

			const result = await controller.update(
				updateUserDto,
				mockRequest,
				mockResponse,
			);

			expect(mockAuthService.update).toHaveBeenCalledWith(
				'user-id-123',
				updateUserDto,
				mockResponse,
			);
			expect(result).toEqual(mockResult);
		});
	});
});
