import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PrivateMessageDocument = HydratedDocument<PrivateMessage>;

@Schema({ timestamps: true })
export class PrivateMessage {
	@Prop({
		type: Types.ObjectId,
		ref: 'Conversation',
		required: true,
		index: true,
	})
	conversation: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
	sender: Types.ObjectId;

	@Prop({ required: true })
	content: string;

	@Prop()
	modification?: string;

	@Prop({ type: Types.ObjectId, ref: 'PrivateMessage', index: true })
	reply?: Types.ObjectId;

	createdAt: Date;
	updatedAt: Date;
}

export const PrivateMessageSchema =
	SchemaFactory.createForClass(PrivateMessage);
