import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Follow, FollowDocument } from './schemas/follow.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Model, Types } from 'mongoose';
import { MongoServerError } from 'mongodb';

@Injectable()
export class FollowService {
  constructor(
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const followingUser = await this.userModel.findById(followingId);
    if (!followingUser) {
      throw new NotFoundException('User not found');
    }

    try {
      await this.followModel.create({
        follower: new Types.ObjectId(followerId),
        following: new Types.ObjectId(followingId),
      });
    } catch (err: unknown) {
      const error = err as MongoServerError;
      if (error.code === 11000) {
        throw new BadRequestException('Already following this user');
      }
      throw err;
    }

    return { success: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    await this.followModel.deleteOne({
      follower: followerId,
      following: followingId,
    });

    return { success: true };
  }

  async isFollowing(followerId: string, followingId: string) {
    const exists = await this.followModel.exists({
      follower: followerId,
      following: followingId,
    });

    return { isFollowing: !!exists };
  }

  async getFollowers(userId: string, page = 1, size = 10) {
    const limit = Math.min(size, 50);
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      this.followModel
        .find({ following: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('follower', 'username')
        .lean(),
      this.followModel.countDocuments({ following: userId }),
    ]);

    const data = followers.map((f) => f.follower);

    return {
      data,
      page,
      size: limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFollowing(userId: string, page = 1, size = 10) {
    const limit = Math.min(size, 50);
    const skip = (page - 1) * limit;

    const [following, total] = await Promise.all([
      this.followModel
        .find({ follower: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('following', 'username')
        .lean(),
      this.followModel.countDocuments({ follower: userId }),
    ]);

    const data = following.map((f) => f.following);

    return {
      data,
      page,
      size: limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
