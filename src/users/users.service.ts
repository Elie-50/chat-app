import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.userModel.create(createUserDto);
  }

  async findOneWithEmail(email: string): Promise<User | null> {
    const user = await this.userModel.findOne({ email: email }).exec();
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate({ _id: id }, updateUserDto, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async delete(id: string): Promise<User> {
    const user = await this.userModel.findByIdAndDelete({ _id: id }).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmailAndVerify(
    email: string,
    verificationCode: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findOne({ email, verificationCode });

    if (!user) {
      throw new BadRequestException('Invalid verification code');
    }

    const now = new Date();
    if (!user.verificationDue || user.verificationDue < now) {
      throw new BadRequestException('Verification code has expired');
    }

    user.verificationCode = '';
    user.verificationDue = undefined;

    await user.save();

    return user;
  }

  async findOrCreate(email: string): Promise<User> {
    const user = await this.findOneWithEmail(email);

    if (!user) {
      const verificationDue = new Date(Date.now() + 2 * 3600 * 1000);
      const verificationCode = this.generateRandomSixDigitNumber();
      const create = await this.create({
        email,
        verificationCode,
        verificationDue,
      });

      return create;
    }

    return user;
  }

  private generateRandomSixDigitNumber(): string {
    return (Math.floor(Math.random() * 900000) + 100000).toString();
  }
}
