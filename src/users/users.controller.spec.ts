import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUsersService = {
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
            signAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('update', () => {
    it('should update the user and return updated data', async () => {
      const updateUserDto = { username: 'newUsername' };
      const mockUser = {
        _id: 'userId',
        username: 'newUsername',
        email: 'test@example.com',
      };

      // Mock the service method to return the updated user
      usersService.update.mockResolvedValue(mockUser as any);

      // Simulate an authenticated request object
      const mockReq = {
        user: { _id: 'userId' }, // Simulating authenticated user
      } as any;

      // Call the controller's update method
      const result = await controller.update(updateUserDto, mockReq);

      // Assert that the result is what we expect
      expect(result).toEqual(mockUser);
      expect(usersService.update).toHaveBeenCalledWith('userId', updateUserDto);
      expect(usersService.update).toHaveBeenCalledTimes(1); // Ensure the method was called only once
    });

    it('should throw a NotFoundException if user not found', async () => {
      const updateUserDto = { username: 'newUsername' };

      // Mock the service method to simulate a user not found scenario
      usersService.update.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      // Simulate an authenticated request object
      const mockReq = {
        user: { _id: 'nonExistingUserId' }, // Simulate a non-existing user ID
      } as any;

      // Test that the controller throws the expected exception
      await expect(controller.update(updateUserDto, mockReq)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw an error if there is a problem with the request', async () => {
      const updateUserDto = { username: 'newUsername' };

      // Mock the service method to simulate a generic error
      usersService.update.mockRejectedValue(new Error('Something went wrong'));

      // Simulate an authenticated request object
      const mockReq = {
        user: { _id: 'userId' },
      } as any;

      // Test that the controller throws a generic error
      await expect(controller.update(updateUserDto, mockReq)).rejects.toThrow(
        Error,
      );
    });
  });
});
