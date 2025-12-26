import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { CreateGroupMessageDto } from './dto/create-group-message.dto';
import { UpdateGroupMessageDto } from './dto/update-group-message.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../users/schemas/user.schema';
import { Model, Types } from 'mongoose';
import { GroupMessage } from './schemas/group-message.schema';
import { Conversation } from '../conversations/schemas/conversation.schema';

type ReplyToSend = {
	_id: string;
	sender: {
		_id: string;
		username: string;
	};
	content: string;
	modification?: string;
};

@Injectable()
export class GroupChatService {
	constructor(
		@InjectModel(User.name) private readonly userModel: Model<User>,
		@InjectModel(GroupMessage.name)
		private readonly groupMessageModel: Model<GroupMessage>,
		@InjectModel(Conversation.name)
		private readonly conversationModel: Model<Conversation>,
	) {}

	async create(currentUserId: string, dto: CreateGroupMessageDto) {
		const conversation = await this.conversationModel
			.findById(dto.id)
			.populate('participants', 'username');

		if (!conversation) {
			throw new NotFoundException('conversation not found');
		}

		const sender = await this.userModel.findById(currentUserId);

		if (!sender) {
			throw new NotFoundException('User not found');
		}

		// fecth the reply if it exists
		let replyObjId: Types.ObjectId | undefined;
		let reply: ReplyToSend | undefined;
		if (dto.repliedTo) {
			replyObjId = new Types.ObjectId(dto.repliedTo);
			const replyObj = await this.groupMessageModel
				.findById(replyObjId)
				.populate('sender', 'username');

			if (!replyObj) {
				reply = undefined;
			} else {
				reply = {
					_id: dto.repliedTo,
					sender: {
						_id: '',
						username:
							(replyObj.sender as unknown as User).username || '[Not Found]',
					},
					content: replyObj.content,
					modification: replyObj.modification,
				};
			}
		}

		const message = await this.groupMessageModel.create({
			conversation: conversation._id,
			sender: sender._id,
			content: dto.content,
			reply: replyObjId,
		});

		const result = {
			_id: message._id,
			sender: sender.username,
			content: message.content,
			createdAt: message.createdAt,
			reply,
		};

		return { conversation, message: result };
	}

	async findAll(senderId: string, conversationId: string, page = 1, size = 20) {
		const senderObjId = new Types.ObjectId(senderId);
		const conversationObjId = new Types.ObjectId(conversationId);

		const conversation =
			await this.conversationModel.findById(conversationObjId);

		if (!conversation) throw new NotFoundException('Conversation not found');

		const isAdmin = conversation.admin?.equals(senderObjId);

		if (!isAdmin) {
			const isMember = conversation.participants.find((p) =>
				p.equals(senderObjId),
			);
			if (!isMember) {
				throw new ForbiddenException("Cannot access this group's messages");
			}
		}

		const limit = Math.min(size, 50);
		const skip = (page - 1) * limit;

		const [messages, total] = await Promise.all([
			this.groupMessageModel
				.find({ conversation: conversation._id })
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate('sender', 'username')
				.populate({
					path: 'reply',
					select: '_id sender content modification',
					populate: { path: 'sender', select: 'username' },
				})
				.lean(),
			this.groupMessageModel.countDocuments({
				conversation: conversation._id,
			}),
		]);

		const messagesWithSender = messages.map((message) => ({
			...message,
			sender: (message.sender as unknown as User).username,
		}));

		return {
			data: messagesWithSender.reverse(),
			page,
			size: limit,
			total,
			totalPages: Math.ceil(total / limit),
		};
	}

	async update(
		senderId: string,
		messageId: string,
		dto: UpdateGroupMessageDto,
	) {
		const message = await this.groupMessageModel.findById(messageId);
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

	async remove(currentUserId: string, messageId: string) {
		const message = await this.groupMessageModel.findById(messageId);
		if (!message) throw new NotFoundException('Message not found');

		const currentUserObjId = new Types.ObjectId(currentUserId);

		// Check conversation exists
		const conversation = await this.conversationModel.findById(
			message.conversation,
		);
		if (!conversation) throw new NotFoundException('Conversation not found');

		const sender = await this.userModel.findById(message.sender);

		if (!sender) {
			throw new NotFoundException('sender not foun');
		}

		// Only sender can delete
		if (
			!message.sender.equals(currentUserObjId) &&
			!conversation.admin?.equals(currentUserObjId)
		) {
			throw new ForbiddenException('You cannot delete this message');
		}

		const modification = message.sender.equals(currentUserObjId)
			? 'Deleted'
			: 'Deleted By Admin';

		// await this.privateMessageModel.findByIdAndDelete(message._id);
		message.modification = modification;
		await message.save();
		const result = {
			_id: message._id,
			sender: sender.username,
			content: message.content,
			modification: message.modification,
		};

		return { message: result, conversation };
	}
}
