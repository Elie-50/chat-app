import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePrivateMessageDto {
	@IsNotEmpty()
	@IsString()
	id: string;

	@IsNotEmpty()
	@IsString()
	ciphertext: string;

	@IsNotEmpty()
	@IsString()
	nonce: string;

	@IsNotEmpty()
	@IsString()
	signature: string;

	repliedTo?: string;
}
