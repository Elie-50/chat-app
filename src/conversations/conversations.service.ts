import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class ConversationsService {
	constructor(
		@InjectModel(Conversation.name)
		private readonly conversationModel: Model<Conversation>,
	) {}

	create(userId: string, name: string) {
		return this.conversationModel.create({
			admin: new Types.ObjectId(userId),
			participants: [new Types.ObjectId(userId)],
			name,
			type: 'group',
		});
	}

	async findAll(userId: string, page: number = 1, size: number = 20) {
		const skip = (page - 1) * size;
		const limit = Math.min(size, 50);
		const userObjId = new Types.ObjectId(userId);

		const [data, total] = await Promise.all([
			this.conversationModel
				.find({ participants: userObjId })
				.sort({ updatedAt: -1 })
				.select('name admin')
				.skip(skip)
				.limit(limit)
				.exec(),

			this.conversationModel.countDocuments({
				participants: userObjId,
			}),
		]);

		return {
			data,
			total,
			page,
			size: limit,
			totalPages: Math.ceil(total / limit),
		};
	}

	async findOne(id: string) {
		const conversationObjId = new Types.ObjectId(id);
		const conversation =
			await this.conversationModel.findById(conversationObjId);

		if (!conversation) {
			throw new NotFoundException('Conversation not found');
		}

		return conversation;
	}

	async update(id: string, userId: string, newName: string) {
		const conversation = await this.conversationModel.findById(id);

		if (!conversation) {
			throw new NotFoundException('Conversation not found');
		}

		if (userId != conversation.admin?.toString()) {
			throw new ForbiddenException('Permission denied');
		}

		conversation.name = newName;
		await conversation.save();

		return conversation;
	}
}
