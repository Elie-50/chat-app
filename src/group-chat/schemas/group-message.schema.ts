import { SchemaFactory, Prop, Schema } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GroupMessageDocument = HydratedDocument<GroupMessage>;

@Schema({ timestamps: true })
export class GroupMessage {
	@Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
	conversation: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'User', required: true })
	sender: Types.ObjectId;

	@Prop({ required: true })
	content: string;

	@Prop()
	modification?: string;

	createdAt: Date;
	updatedAt: Date;
}

export const GroupMessageSchema = SchemaFactory.createForClass(GroupMessage);
