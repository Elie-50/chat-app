import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Model, PipelineStage, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { FacetResult, PaginatedConversations } from './conversations.types';

@Injectable()
export class ConversationsService {
	constructor(
		@InjectModel(Conversation.name)
		private readonly conversationModel: Model<Conversation>,
		@InjectModel(User.name)
		private readonly userModel: Model<User>,
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
				.find({ participants: userObjId, type: 'group' })
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

		await conversation.populate({
			path: 'participants',
			select: 'username',
		});

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
		const data = {
			_id: member._id,
			username: member.username,
		};
		return { member: data };
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

	async getUserConversations(
		userId: string,
		dto: GetConversationsDto,
	): Promise<PaginatedConversations> {
		const { filter, page, limit } = dto;

		const userObjectId = new Types.ObjectId(userId);
		const skip = (page - 1) * limit;

		const matchStage: PipelineStage.Match['$match'] = {
			participants: userObjectId,
			...(filter === 'groups' && { type: 'group' }),
			...(filter === 'dms' && { type: 'dm' }),
		};

		const pipeline: PipelineStage[] = [
			{ $match: matchStage },

			{ $sort: { updatedAt: -1 } },

			{
				$addFields: {
					otherUserId: {
						$cond: [
							{ $eq: ['$type', 'dm'] },
							{
								$first: {
									$filter: {
										input: '$participants',
										as: 'p',
										cond: { $ne: ['$$p', userObjectId] },
									},
								},
							},
							null,
						],
					},
				},
			},

			{
				$lookup: {
					from: 'users',
					localField: 'otherUserId',
					foreignField: '_id',
					as: 'otherUser',
				},
			},

			{ $unwind: { path: '$otherUser', preserveNullAndEmptyArrays: true } },

			{
				$project: {
					type: 1,
					updatedAt: 1,
					name: {
						$cond: [
							{ $eq: ['$type', 'group'] },
							'$name',
							'$otherUser.username',
						],
					},
					_id: {
						$cond: [{ $eq: ['$type', 'group'] }, '$_id', '$otherUser._id'],
					},
				},
			},

			{
				$facet: {
					data: [{ $skip: skip }, { $limit: limit }],
					total: [{ $count: 'count' }],
				},
			},
		];

		const [result] = await this.conversationModel
			.aggregate<FacetResult>(pipeline)
			.exec();

		return {
			data: result?.data ?? [],
			total: result?.total[0]?.count ?? 0,
			page,
			limit,
		};
	}
}
