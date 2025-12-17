import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

describe('AuthGuard', () => {
	let guard: AuthGuard;
	let jwtService: JwtService;

	const mockJwtService = {
		verifyAsync: jest.fn(),
	};

	beforeEach(() => {
		jest.resetAllMocks();
		jwtService = mockJwtService as any;
		guard = new AuthGuard(jwtService);
	});

	const mockExecutionContext = (headers: Record<string, string>) => {
		const req = {
			headers,
		} as AuthenticatedRequest;

		return {
			switchToHttp: () => ({
				getRequest: () => req,
			}),
		} as unknown as ExecutionContext;
	};

	it('should be defined', () => {
		expect(guard).toBeDefined();
	});

	it('should return true for a valid token', async () => {
		const mockPayload = { userId: 123 };
		mockJwtService.verifyAsync.mockResolvedValueOnce(mockPayload);

		const context = mockExecutionContext({
			authorization: 'Bearer valid-token',
		});

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
		const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
		expect(req.user).toEqual(mockPayload);
		expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
			secret: process.env.JWT_SECRET!,
		});
	});

	it('should throw UnauthorizedException if no token is present', async () => {
		const context = mockExecutionContext({});

		await expect(guard.canActivate(context)).rejects.toThrow(
			UnauthorizedException,
		);
		expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('should throw UnauthorizedException if token is invalid', async () => {
		mockJwtService.verifyAsync.mockRejectedValueOnce(
			new Error('Invalid token'),
		);

		const context = mockExecutionContext({
			authorization: 'Bearer invalid-token',
		});

		await expect(guard.canActivate(context)).rejects.toThrow(
			UnauthorizedException,
		);
		expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('invalid-token', {
			secret: process.env.JWT_SECRET!,
		});
	});

	it('should return undefined if auth type is not Bearer', async () => {
		const context = mockExecutionContext({
			authorization: 'Basic sometoken',
		});

		await expect(guard.canActivate(context)).rejects.toThrow(
			UnauthorizedException,
		);
	});
});
