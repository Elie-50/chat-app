import { IsEmail, IsNumberString, Length } from 'class-validator';

export class VerifyCodeDto {
	@IsEmail()
	email: string;

	@IsNumberString()
	@Length(6, 6, { message: 'Code must be exactly 6 digits' })
	code: string;
}
