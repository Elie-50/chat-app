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
		const follow = await this.followModel.findOne({
			follower: new Types.ObjectId(followerId),
			following: new Types.ObjectId(followingId),
		});

		if (!follow) {
			throw new NotFoundException('You are not following this user');
		}

		await this.followModel.findByIdAndDelete(follow._id);

		return { success: true };
	}

	async getFollowers(userId: string, page = 1, size = 10) {
		const limit = Math.min(size, 50);
		const skip = (page - 1) * limit;

		const [followers, total] = await Promise.all([
			this.followModel
				.find({ following: new Types.ObjectId(userId) })
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate('follower', 'username')
				.lean(),
			this.followModel.countDocuments({
				following: new Types.ObjectId(userId),
			}),
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
				.find({ follower: new Types.ObjectId(userId) })
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate('following', 'username')
				.lean(),
			this.followModel.countDocuments({ follower: new Types.ObjectId(userId) }),
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
