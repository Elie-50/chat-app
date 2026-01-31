import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AuthDto {
	@IsString()
	@IsNotEmpty()
	@MinLength(3)
	username: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	password: string;
}
