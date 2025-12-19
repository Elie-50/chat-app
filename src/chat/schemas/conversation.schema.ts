import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
	@Prop({ type: [Types.ObjectId], ref: 'User', required: true })
	participants: Types.ObjectId[];

	@Prop({ default: 'dm' })
	type: string;

	@Prop({ type: Types.ObjectId, ref: 'User' })
	admin?: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
