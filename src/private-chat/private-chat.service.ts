import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { CreatePrivateMessageDto } from './dto/create-private-chat.dto';
import { UpdatePrivateMessageDto } from './dto/update-private-chat.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation } from '../conversations/schemas/conversation.schema';
import { Model, Types } from 'mongoose';
import { PrivateMessage } from './schemas/private-message.schema';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class PrivateChatService {
	constructor(
		@InjectModel(Conversation.name)
		private readonly conversationModel: Model<Conversation>,
		@InjectModel(PrivateMessage.name)
		private readonly privateMessageModel: Model<PrivateMessage>,
		@InjectModel(User.name)
		private readonly userModel: Model<User>,
	) {}

	async create(senderId: string, dto: CreatePrivateMessageDto) {
		const senderObjId = new Types.ObjectId(senderId);
		const recipientObjId = new Types.ObjectId(dto.id);

		const sender = await this.userModel.findById(senderObjId);

		if (!sender) {
			throw new NotFoundException('User not found');
		}

		// Check for existing conversation
		const participants = [senderObjId, recipientObjId].sort();

		let conversation = await this.conversationModel.findOne({
			participants: { $all: participants, $size: 2 },
		});

		// If not exists, create one
		if (!conversation) {
			conversation = await this.conversationModel.create({
				participants: participants,
				type: 'dm',
			});
		}

		// Save message
		const message = await this.privateMessageModel.create({
			conversation: conversation._id,
			sender: senderObjId,
			content: dto.content,
		});

		const result = {
			_id: message._id,
			sender: sender.username,
			content: message.content,
		};

		return { conversation, message: result };
	}

	async update(
		senderId: string,
		messageId: string,
		dto: UpdatePrivateMessageDto,
	) {
		const message = await this.privateMessageModel.findById(messageId);
		if (!message) throw new NotFoundException('Message not found');

		// Check conversation exists
		const conversation = await this.conversationModel.findById(
			message.conversation,
		);
		if (!conversation) throw new NotFoundException('Conversation not found');

		// Only sender can update
		if (message.sender.toString() !== senderId) {
			throw new ForbiddenException('You can only edit your own messages');
		}
		const sender = await this.userModel.findById(message.sender);

		if (!sender) {
			throw new NotFoundException('User not found');
		}

		if (!dto.content) {
			throw new BadRequestException('Cannot leave empty messages');
		}

		message.content = dto.content;
		message.modification = 'Edited';
		await message.save();

		const result = {
			_id: message._id,
			sender: sender.username,
			content: message.content,
			modification: message.modification,
		};

		return { message: result, conversation };
	}

	async remove(senderId: string, messageId: string) {
		const message = await this.privateMessageModel.findById(messageId);
		if (!message) throw new NotFoundException('Message not found');

		// Check conversation exists
		const conversation = await this.conversationModel.findById(
			message.conversation,
		);
		if (!conversation) throw new NotFoundException('Conversation not found');

		// Only sender can delete
		if (message.sender.toString() !== senderId) {
			throw new ForbiddenException('You can only delete your own messages');
		}

		const sender = await this.userModel.findById(message.sender);

		if (!sender) {
			throw new NotFoundException('User not found');
		}

		// await this.privateMessageModel.findByIdAndDelete(message._id);
		message.modification = 'Deleted';
		await message.save();
		const result = {
			_id: message._id,
			sender: sender.username,
			content: message.content,
			modification: message.modification,
		};

		return { message: result, conversation };
	}

	async findAll(senderId: string, recipientId: string, page = 1, size = 20) {
		const senderObjId = new Types.ObjectId(senderId);
		const recipientObjId = new Types.ObjectId(recipientId);

		const participants = [senderObjId, recipientObjId].sort();

		// Find the conversation between sender and recipient
		const conversation = await this.conversationModel.findOne({
			participants: { $all: participants, $size: 2 },
		});

		if (!conversation) throw new NotFoundException('Conversation not found');

		const limit = Math.min(size, 50);
		const skip = (page - 1) * limit;

		const [messages, total] = await Promise.all([
			this.privateMessageModel
				.find({ conversation: conversation._id })
				.sort({ createdAt: 1 }) // oldest first
				.skip(skip)
				.limit(limit)
				.populate('sender', 'username')
				.lean(),
			this.privateMessageModel.countDocuments({
				conversation: conversation._id,
			}),
		]);

		const messagesWithSender = messages.map((message) => ({
			...message,
			sender: (message.sender as unknown as User).username,
		}));

		return {
			data: messagesWithSender,
			page,
			size: limit,
			total,
			totalPages: Math.ceil(total / limit),
		};
	}
}
