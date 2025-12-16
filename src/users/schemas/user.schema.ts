import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({ unique: true, maxLength: 50, minlength: 3, required: false })
  username?: string;

  @Prop({ unique: true, required: true, index: true })
  email: string;

  @Prop({ required: false })
  verificationCode: string;

  @Prop({ required: false })
  verificationDue?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ username: 1 });
