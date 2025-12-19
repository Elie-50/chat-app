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
import { Conversation } from '../chat/schemas/conversation.schema';

@Injectable()
export class GroupChatService {
	constructor(
		@InjectModel(User.name) private readonly userModel: Model<User>,
		@InjectModel(GroupMessage.name)
		private readonly groupMessageModel: Model<GroupMessage>,
		@InjectModel(Conversation.name)
		private readonly conversationModel: Model<Conversation>,
	) {}

	async create(
		currentUserId: string,
		createGroupMessageDto: CreateGroupMessageDto,
	) {
		const conversation = await this.conversationModel.findById(
			createGroupMessageDto.conversationId,
		);

		if (!conversation) {
			throw new NotFoundException('conversation not found');
		}

		const sender = await this.userModel.findById(currentUserId);

		if (!sender) {
			throw new NotFoundException('User not found');
		}

		const message = await this.groupMessageModel.create({
			conversation: conversation._id,
			sender: sender._id,
			content: createGroupMessageDto.content,
		});

		const result = {
			_id: message._id,
			sender: sender.username,
			content: message.content,
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
				.sort({ createdAt: 1 }) // oldest first
				.skip(skip)
				.limit(limit)
				.populate('sender', 'username')
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
			data: messagesWithSender,
			page,
			size: limit,
			total,
			totalPages: Math.ceil(total / limit),
		};
	}

	async addMember(
		memberId: string,
		currentUserId: string,
		conversationId: string,
	) {
		const conversationObjId = new Types.ObjectId(conversationId);

		const conversation =
			await this.conversationModel.findById(conversationObjId);

		if (!conversation) {
			throw new NotFoundException('Conversation not found');
		}

		const memberObjId = new Types.ObjectId(memberId);
		const member = await this.userModel.findById(memberObjId);

		if (!member) {
			throw new NotFoundException('Member not found');
		}

		const currentUserObjId = new Types.ObjectId(currentUserId);

		if (conversation.admin && !conversation.admin.equals(currentUserObjId)) {
			throw new ForbiddenException(
				'You are not allowed to add members to this chat',
			);
		}

		if (conversation.participants.some((p) => p.equals(memberObjId))) {
			throw new BadRequestException('User already in group');
		}

		conversation.participants.push(memberObjId);

		await conversation.save();
	}

	async removeMember(
		memberId: string,
		currentUserId: string,
		conversationId: string,
	) {
		const conversation = await this.conversationModel.findById(conversationId);

		if (!conversation) {
			throw new NotFoundException('Conversation not found');
		}

		const memberObjId = new Types.ObjectId(memberId);
		const currentUserObjId = new Types.ObjectId(currentUserId);

		// Check if member is in conversation
		const isMember = conversation.participants.some((p) =>
			p.equals(memberObjId),
		);

		if (!isMember) {
			throw new BadRequestException('User is not in this conversation');
		}

		const isAdmin =
			conversation.admin && conversation.admin.equals(currentUserObjId);

		const isSelf = memberObjId.equals(currentUserObjId);

		// Permission check
		if (!isAdmin && !isSelf) {
			throw new ForbiddenException('You are not allowed to remove this member');
		}

		// Optional: prevent removing admin
		if (conversation.admin && conversation.admin.equals(memberObjId)) {
			throw new BadRequestException('Admin cannot be removed from the group');
		}

		// Remove member
		conversation.participants = conversation.participants.filter(
			(p) => !p.equals(memberObjId),
		);

		await conversation.save();
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
		return { message, conversation };
	}
}
