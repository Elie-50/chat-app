import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePrivateMessageDto {
	@IsNotEmpty()
	@IsString()
	recipientId: string;

	@IsNotEmpty()
	@IsString()
	content: string;
}
