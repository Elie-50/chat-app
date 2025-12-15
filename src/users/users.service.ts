import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model, Types } from 'mongoose';
import { UpdateUserDto } from './dto/update-user.dto';

export type SafeUserReturn = {
  _id: Types.ObjectId;
  username?: string;
  email: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async create(email: string): Promise<UserDocument | null> {
    return this.userModel.create({ email });
  }

  async findOneWithEmail(email: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email: email }).exec();
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<SafeUserReturn> {
    const user = await this.userModel
      .findByIdAndUpdate({ _id: id }, updateUserDto, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { _id, username, email } = user;
    return { _id, username, email };
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
  ): Promise<SafeUserReturn> {
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

    const { username, _id } = user;
    return { username, email, _id };
  }

  async findOrCreate(email: string): Promise<User> {
    let user: UserDocument | null = await this.findOneWithEmail(email);

    if (!user) {
      user = await this.create(email);
    }

    if (!user) {
      throw new InternalServerErrorException('Unexpected Error occured');
    }

    user.verificationCode = this.generateRandomSixDigitNumber();
    user.verificationDue = new Date(Date.now() + 2 * 3600 * 1000);

    await user.save();

    return user;
  }

  private generateRandomSixDigitNumber(): string {
    return (Math.floor(Math.random() * 900000) + 100000).toString();
  }
}
