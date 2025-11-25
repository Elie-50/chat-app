import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { NotFoundException } from '@nestjs/common';

const userModelMock = {
  create: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
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
          provide: getModelToken('User'),
          useValue: userModelMock,
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

      const createUserDto = {
        email: 'user@example.com',
        verificationCode: '123456',
        verificationDue: new Date(),
      };
      const result = await service.create(createUserDto);

      expect(result).toEqual(mockedUser);
      expect(model.create).toHaveBeenCalledWith(createUserDto);
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
    it('should update a user', async () => {
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(mockedUser),
      } as any);

      const id = new Types.ObjectId().toString();
      const updateUserDto = {
        username: 'username',
      };
      const result = await service.update(id, updateUserDto);

      expect(result).toEqual(mockedUser);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        { _id: id },
        updateUserDto,
        { new: true },
      );
    });

    it('should throw NotFoundException when user is not found', async () => {
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValueOnce(null),
      } as any);

      const id = new Types.ObjectId().toString();
      await expect(service.update(id, {})).rejects.toThrow(NotFoundException);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        { _id: id },
        {},
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
      const userMock = {
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
      expect(result).toEqual(userMock);
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
  });

  describe('findOrCreate', () => {
    it('should return existing user', async () => {
      // mock service.findOneWithEmail instead of model.findOne
      jest
        .spyOn(service, 'findOneWithEmail')
        .mockResolvedValueOnce(mockedUser as any);

      const result = await service.findOrCreate(mockedUser.email);

      expect(service.findOneWithEmail).toHaveBeenCalledWith(mockedUser.email);
      expect(result).toEqual(mockedUser);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('should create a new user when none exists', async () => {
      jest.spyOn(service, 'findOneWithEmail').mockResolvedValueOnce(null);

      const createdUser = { ...mockedUser };
      model.create.mockResolvedValueOnce(createdUser as any);

      // stable predictable code
      jest
        .spyOn<any, any>(service as any, 'generateRandomSixDigitNumber')
        .mockReturnValue('111111');

      const result = await service.findOrCreate(mockedUser.email);

      expect(service.findOneWithEmail).toHaveBeenCalledWith(mockedUser.email);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockedUser.email,
          verificationCode: '111111',
          verificationDue: expect.any(Date),
        }),
      );

      expect(result).toEqual(createdUser);
    });

    it('should throw if verification code is expired', async () => {
      const expiredUser = {
        _id: 'someId',
        email: 'test@example.com',
        verificationCode: '123456',
        verificationDue: new Date(Date.now() - 3 * 3600 * 1000), // 3 hours ago
        save: jest.fn(),
      } as any;

      jest.spyOn(model, 'findOne').mockResolvedValueOnce(expiredUser);

      await expect(
        service.findByEmailAndVerify(
          expiredUser.email,
          expiredUser.verificationCode,
        ),
      ).rejects.toThrow('Verification code has expired');
    });
  });
});
