import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EncryptedPrivateMessageDocument =
	HydratedDocument<EncryptedPrivateMessage>;

@Schema({ timestamps: true })
export class EncryptedPrivateMessage {
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
	ciphertext: string;

	@Prop({ required: true })
	nonce: string;

	@Prop({ required: true })
	signature: string;

	@Prop()
	modification?: string;

	@Prop({ type: Types.ObjectId, ref: 'PrivateMessage', index: true })
	reply?: Types.ObjectId;

	createdAt: Date;
	updatedAt: Date;
}

export const EncryptedPrivateMessageSchema = SchemaFactory.createForClass(
	EncryptedPrivateMessage,
);
