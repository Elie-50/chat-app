import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    requestCode: jest.fn(),
    verify: jest.fn(),
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
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  describe('requestCode', () => {
    it('should call authService.requestCode and return result', async () => {
      const mockResult = { message: 'Email sent successfully' };
      authService.requestCode.mockResolvedValueOnce(mockResult);

      const result = await controller.requestCode({
        email: 'test@example.com',
      });

      expect(authService.requestCode).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual(mockResult);
    });
  });

  describe('verifyEmail', () => {
    it('should call authService.verify with correct params', async () => {
      const mockUser = { _id: '123', email: 'test@example.com' };
      authService.verify.mockResolvedValueOnce(mockUser as any);

      const result = await controller.verifyEmail({
        email: 'test@example.com',
        code: '123456',
      });

      expect(authService.verify).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
      );

      expect(result).toEqual(mockUser);
    });
  });
});
