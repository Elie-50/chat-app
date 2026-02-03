import { Types } from 'mongoose';

export type ConversationType = 'dm' | 'group';

export interface ConversationListItem {
	_id: Types.ObjectId;
	type: ConversationType;
	name: string;
	updatedAt: Date;
}

export interface PaginatedConversations {
	data: ConversationListItem[];
	total: number;
	page: number;
	limit: number;
}

export interface FacetResult {
	data: ConversationListItem[];
	total: { count: number }[];
}
