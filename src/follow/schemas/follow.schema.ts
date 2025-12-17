import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FollowDocument = HydratedDocument<Follow>;

@Schema({ timestamps: true })
export class Follow {
	@Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
	follower: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
	following: Types.ObjectId;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);

// 🔒 Prevent duplicate follows
FollowSchema.index({ follower: 1, following: 1 }, { unique: true });
