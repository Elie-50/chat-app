import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: JwtService;

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockExecutionContext = (
    req: Partial<AuthenticatedRequest>,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [AuthGuard, { provide: JwtService, useValue: mockJwtService }],
    }).compile();

    guard = module.get(AuthGuard);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException if no token exists', async () => {
      const req = { cookies: {} };
      const ctx = mockExecutionContext(req);

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if token verification fails', async () => {
      const req = { cookies: { access_token: 'invalid.token' } };
      const ctx = mockExecutionContext(req);

      mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('Invalid'));

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('invalid.token', {
        secret: process.env.JWT_SECRET,
      });
    });
  });
});
