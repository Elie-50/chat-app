import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
	@Prop({
		unique: true,
		maxLength: 50,
		minlength: 3,
		index: true,
	})
	username: string;

	@Prop({ unique: true, required: true, index: true })
	email: string;

	@Prop({})
	password: string;

	@Prop({ default: false })
	isOnline: boolean;

	@Prop({ required: false })
	lastSeen?: Date;

	@Prop({ required: false })
	identityPublicKey: string;

	@Prop({ required: false })
	exchangePublicKey: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
