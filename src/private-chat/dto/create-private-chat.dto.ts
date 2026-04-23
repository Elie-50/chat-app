import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePrivateMessageDto {
	@IsNotEmpty()
	@IsString()
	id: string;

	@IsNotEmpty()
	@IsString()
	content: string;

	repliedTo?: string;
}
