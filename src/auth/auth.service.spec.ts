import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let emailService: jest.Mocked<EmailService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUsersService = {
    findOrCreate: jest.fn(),
    findByEmailAndVerify: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationCode: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockUser = {
    _id: 'user-id-123',
    email: 'test@example.com',
    verificationCode: '123456',
    verificationDue: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    emailService = module.get(EmailService);
    jwtService = module.get(JwtService);
  });

  describe('requestCode', () => {
    it('should send verification code and return success', async () => {
      usersService.findOrCreate.mockResolvedValueOnce(mockUser as any);

      const result = await service.requestCode('test@example.com');

      expect(usersService.findOrCreate).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
        mockUser.verificationCode,
        'test@example.com',
      );
      expect(result).toEqual({ message: 'Email sent successfully' });
    });
  });

  describe('verify', () => {
    it('should verify user, sign token, set cookie, and return user', async () => {
      usersService.findByEmailAndVerify.mockResolvedValueOnce({
        ...mockUser,
        _id: { toString: () => 'user-id-123' },
      } as any);

      jwtService.signAsync.mockResolvedValueOnce('signed-token');

      const result = await service.verify('test@example.com', '123456');

      expect(usersService.findByEmailAndVerify).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith({ _id: 'user-id-123' });

      expect(result.user).toEqual({
        _id: { toString: expect.any(Function) },
        email: mockUser.email,
        verificationCode: mockUser.verificationCode,
        verificationDue: expect.any(Date),
      });

      expect(result.accessToken).toEqual('signed-token');
    });

    it('should throw NotFoundException when user is not found', async () => {
      usersService.findByEmailAndVerify.mockResolvedValueOnce(null as any);

      await expect(service.verify('a@b.com', '000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
