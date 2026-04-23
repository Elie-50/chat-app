import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
	@Prop({ maxLength: 50, minLength: 2, index: true })
	name?: string;

	@Prop({ type: [Types.ObjectId], ref: 'User', required: true })
	participants: Types.ObjectId[];

	@Prop({ default: 'dm', index: true })
	type: string;

	@Prop({ type: Types.ObjectId, ref: 'User', index: true })
	admin?: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
