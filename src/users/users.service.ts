import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { FilterQuery, Model, Types } from 'mongoose';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

interface Keys {
	identityPublicKey: string;
	exchangePublicKey: string;
}

@Injectable()
export class UsersService {
	constructor(
		@InjectModel(User.name) private readonly userModel: Model<User>,
	) {}

	async create(dto: CreateUserDto): Promise<UserDocument | null> {
		return this.userModel.create(dto);
	}

	async update(id: string, dto: UpdateUserDto) {
		if (dto.username) {
			const otherUser = await this.findOneWithUsername(dto.username);
			if (otherUser && otherUser._id.toString() != id) {
				throw new BadRequestException('This username is taken');
			}
		}
		return this.userModel
			.findByIdAndUpdate({ _id: id }, dto, { new: true })
			.exec();
	}

	async findOneWithUsernameOrEmail(
		username: string,
		email: string,
	): Promise<UserDocument | null> {
		return this.userModel.findOne({
			$or: [{ username }, { email }],
		});
	}

	async findOneWithEmail(email: string): Promise<UserDocument | null> {
		return this.userModel.findOne({ email });
	}

	async findOneWithUsername(username: string): Promise<UserDocument | null> {
		return this.userModel.findOne({ username });
	}

	async findUsersKeys(userId: string) {
		const userObjId = new Types.ObjectId(userId);
		const user = await this.userModel
			.findOne({ _id: userObjId })
			.select('identityPublicKey exchangePublicKey');

		if (!user) {
			throw new NotFoundException('User not found');
		}

		return {
			identityPublicKey: user.identityPublicKey,
			exchangePublicKey: user.exchangePublicKey,
		};
	}

	async storeKeys(userId: string, keys: Keys) {
		return this.userModel.updateOne(
			{
				_id: userId,
				identityPublicKey: { $exists: false },
			},
			{
				identityPublicKey: keys.identityPublicKey,
				exchangePublicKey: keys.exchangePublicKey,
			},
		);
	}

	async delete(id: string): Promise<User> {
		const user = await this.userModel.findByIdAndDelete({ _id: id }).exec();

		if (!user) {
			throw new NotFoundException('User not found');
		}

		return user;
	}

	async searchByUsername(
		username: string,
		page: number = 1,
		size: number = 10,
		currentUserId: string,
	) {
		if (!username) {
			return {
				data: [],
				page,
				size,
				total: 0,
				totalPages: 0,
			};
		}

		const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

		const matchStage: FilterQuery<UserDocument> = {
			username: { $regex: escaped, $options: 'i' },
			_id: { $ne: new Types.ObjectId(currentUserId) },
		};

		const limit = Math.min(size, 50);
		const skip = (page - 1) * limit;

		const [data, total] = await Promise.all([
			this.userModel.aggregate([
				{ $match: matchStage },

				{
					$lookup: {
						from: 'follows',
						let: { userId: '$_id' },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ['$follower', new Types.ObjectId(currentUserId)] },
											{ $eq: ['$following', '$$userId'] },
										],
									},
								},
							},
							{ $limit: 1 },
						],
						as: 'followRelation',
					},
				},

				{
					$addFields: {
						isFollowing: { $gt: [{ $size: '$followRelation' }, 0] },
					},
				},

				{
					$project: {
						username: 1,
						isFollowing: 1,
						isOnline: 1,
						lastSeen: 1,
					},
				},

				{ $skip: skip },
				{ $limit: limit },
			]),

			this.userModel.countDocuments(matchStage),
		]);

		return {
			data,
			page,
			size: limit,
			total,
			totalPages: Math.ceil(total / limit),
		};
	}

	async findOne(userId: string) {
		const userObjId = new Types.ObjectId(userId);
		const user = await this.userModel
			.findById(userObjId)
			.select('_id username isOnline lastSeen');

		if (!user) {
			throw new NotFoundException('User not found');
		}

		return {
			_id: user._id,
			username: user.username,
			isOnline: user.isOnline,
			lastSeen: user.lastSeen,
		};
	}
}
