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
import { User, UserDocument } from '../users/schemas/user.schema';

type ReplyToSend = {
	_id: string;
	sender: {
		_id: string;
		username: string;
		identityPublicKey: string;
	};
	ciphertext: string;
	nonce: string;
	signature: string;
	modification?: string;
};

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

	async findConversationId(senderId: string, recipientId: string) {
		const senderObjId = new Types.ObjectId(senderId);
		const recipientObjId = new Types.ObjectId(recipientId);

		const participants = [senderObjId, recipientObjId].sort();

		const conversation = await this.conversationModel
			.findOne({
				participants: { $all: participants, $size: 2 },
			})
			.select('_id')
			.lean();

		if (!conversation) {
			throw new NotFoundException('Conversation not found');
		}

		return conversation._id.toString();
	}

	async findOrCreateConversationAndReturnId(
		senderId: string,
		recipientId: string,
	) {
		const senderObjId = new Types.ObjectId(senderId);
		const recipientObjId = new Types.ObjectId(recipientId);

		const participants = [senderObjId, recipientObjId].sort();

		let conversation = await this.conversationModel
			.findOne({
				participants: { $all: participants, $size: 2 },
			})
			.select('_id')
			.lean();

		if (!conversation) {
			conversation = await this.conversationModel.create({
				participants: participants,
				type: 'dm',
			});
		}

		if (!conversation) {
			throw new BadRequestException('Unexpected Error Occurred');
		}

		return conversation._id.toString();
	}

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

		// fecth the reply if it exists
		let replyObjId: Types.ObjectId | undefined;
		let reply: ReplyToSend | undefined;
		if (dto.repliedTo) {
			replyObjId = new Types.ObjectId(dto.repliedTo);
			const replyObj = await this.privateMessageModel
				.findById(replyObjId)
				.populate('sender', '_id username identityPublicKey');

			if (!replyObj) {
				reply = undefined;
			} else {
				reply = {
					_id: dto.repliedTo,
					sender: {
						_id:
							(replyObj.sender as unknown as UserDocument)._id.toString() ||
							'[Not Found]',
						username:
							(replyObj.sender as unknown as User).username || '[Not Found]',
						identityPublicKey:
							(replyObj.sender as unknown as User).identityPublicKey ||
							'[Not Found]',
					},
					ciphertext: replyObj.ciphertext,
					nonce: replyObj.nonce,
					signature: replyObj.signature,
					modification: replyObj.modification,
				};
			}
		}

		// Save message
		const message = await this.privateMessageModel.create({
			conversation: conversation._id,
			sender: senderObjId,
			ciphertext: dto.ciphertext,
			signature: dto.signature,
			nonce: dto.nonce,
			reply: replyObjId,
		});

		const senderData = {
			_id: sender._id.toString(),
			username: sender.username,
			identityPublicKey: sender.identityPublicKey,
		};

		const result = {
			_id: message._id,
			sender: senderData,
			ciphertext: message.ciphertext,
			nonce: message.nonce,
			signature: message.signature,
			createdAt: message.createdAt,
			reply,
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

		if (!dto.ciphertext || !dto.nonce || !dto.signature) {
			throw new BadRequestException('Cannot leave empty messages');
		}

		message.ciphertext = dto.ciphertext;
		message.nonce = dto.nonce;
		message.signature = dto.signature;
		message.modification = 'Edited';
		await message.save();

		const senderData = {
			_id: sender._id.toString(),
			username: sender.username,
			identityPublicKey: sender.identityPublicKey,
		};

		const result = {
			_id: message._id,
			sender: senderData,
			ciphertext: message.ciphertext,
			nonce: message.nonce,
			signature: message.signature,
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
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate('sender', 'username identityPublicKey')
				.populate({
					path: 'reply',
					select: '_id sender ciphertext nonce signature modification',
					populate: { path: 'sender', select: 'username identityPublicKey' },
				})
				.lean(),
			this.privateMessageModel.countDocuments({
				conversation: conversation._id,
			}),
		]);
		const data = {
			data: messages.reverse(),
			page,
			size: limit,
			total,
			totalPages: Math.ceil(total / limit),
		};

		return { messages: data, conversation };
	}
}
