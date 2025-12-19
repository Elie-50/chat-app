import { IsNotEmpty, IsString } from 'class-validator';

export class CreateGroupMessageDto {
	@IsString()
	@IsNotEmpty()
	conversationId: string;

	@IsString()
	@IsNotEmpty()
	content: string;
}
