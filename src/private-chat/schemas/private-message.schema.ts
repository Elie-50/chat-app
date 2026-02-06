import { SchemaFactory, Prop, Schema } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PrivateMessageDocument = HydratedDocument<PrivateMessage>;

@Schema({ timestamps: true })
export class PrivateMessage {
	@Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
	conversation: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'User', required: true })
	sender: Types.ObjectId;

	@Prop({ required: true })
	ciphertext: string;

	@Prop({ required: true })
	nonce: string;

	@Prop({ required: true })
	signature: string;

	@Prop()
	modification?: string;

	@Prop({ type: Types.ObjectId, ref: 'PrivateMessage' })
	reply?: Types.ObjectId;

	createdAt: Date;
	updatedAt: Date;
}

export const PrivateMessageSchema =
	SchemaFactory.createForClass(PrivateMessage);

PrivateMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
