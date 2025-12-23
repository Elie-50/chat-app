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

interface CountResult {
	total: number;
}

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

	async getFollowers(
		userId: string,
		currentUserId: string,
		page = 1,
		size = 10,
	) {
		const limit = Math.min(size, 50);
		const skip = (page - 1) * limit;

		const followersAgg = await this.followModel.aggregate([
			{ $match: { following: new Types.ObjectId(userId) } },
			{ $sort: { createdAt: -1 } },
			{ $skip: skip },
			{ $limit: limit },

			{
				$lookup: {
					from: 'users',
					localField: 'follower',
					foreignField: '_id',
					as: 'follower',
				},
			},
			{ $unwind: '$follower' },

			{
				$lookup: {
					from: 'follows',
					let: { followerId: '$follower._id' },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ['$follower', new Types.ObjectId(currentUserId)] },
										{ $eq: ['$following', '$$followerId'] },
									],
								},
							},
						},
					],
					as: 'isFollowingArray',
				},
			},

			{
				$project: {
					_id: '$follower._id',
					username: '$follower.username',
					isFollowing: { $gt: [{ $size: '$isFollowingArray' }, 0] },
				},
			},
		]);

		// Total count
		const total = await this.followModel.countDocuments({
			following: new Types.ObjectId(userId),
		});

		return {
			data: followersAgg,
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

	async getFriends(userId: string, page = 1, size = 10) {
		const userObjId = new Types.ObjectId(userId);
		const limit = Math.min(size, 50);

		const basePipeline = [
			{ $match: { follower: userObjId } },
			{
				$lookup: {
					from: 'follows',
					localField: 'following',
					foreignField: 'follower',
					as: 'mutuals',
				},
			},
			{ $match: { 'mutuals.following': userObjId } },
			{
				$lookup: {
					from: 'users',
					localField: 'following',
					foreignField: '_id',
					as: 'friend',
				},
			},
			{ $unwind: '$friend' },
			{
				$project: {
					_id: '$friend._id',
					username: '$friend.username',
				},
			},
		];

		const countPipeline = [...basePipeline, { $count: 'total' }];
		const countResult = await this.followModel
			.aggregate<CountResult>(countPipeline)
			.exec();
		const totalFriends: number = countResult[0]?.total || 0;

		const paginatedPipeline = [
			...basePipeline,
			{ $skip: (page - 1) * limit },
			{ $limit: limit },
		];
		const friends = await this.followModel.aggregate(paginatedPipeline).exec();

		return {
			totalFriends,
			totalPages: Math.ceil(totalFriends / limit),
			currentPage: page,
			friends,
		};
	}
}
