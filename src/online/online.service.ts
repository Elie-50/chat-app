import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class OnlineService {
	constructor(
		@InjectModel(User.name) private readonly userModel: Model<User>,
	) {}

	changeUserStatus(userId: string, online: boolean) {
		const lastSeen = !online ? new Date() : undefined;
		return this.userModel.findByIdAndUpdate(
			new Types.ObjectId(userId),
			{
				isOnline: online,
				lastSeen: lastSeen,
			},
			{ new: true },
		);
	}

	async checkUserOnlineStatus(userId: string) {
		const user = await this.userModel
			.findById(new Types.ObjectId(userId))
			.select('online lastSeen')
			.lean();

		if (!user) {
			throw new NotFoundException('User not found');
		}

		return user;
	}
}
