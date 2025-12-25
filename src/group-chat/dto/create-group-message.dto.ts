import { IsNotEmpty, IsString } from 'class-validator';

export class CreateGroupMessageDto {
	@IsString()
	@IsNotEmpty()
	id: string;

	@IsString()
	@IsNotEmpty()
	content: string;

	repliedTo?: string;
}
