import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
	@Prop({
		unique: true,
		maxLength: 50,
		minlength: 3,
		required: true,
		index: true,
	})
	username: string;

	@Prop({ unique: true, required: true })
	email: string;

	@Prop({ required: true })
	password: string;

	@Prop({ default: false })
	isOnline: boolean;

	@Prop({ required: false })
	lastSeen?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
