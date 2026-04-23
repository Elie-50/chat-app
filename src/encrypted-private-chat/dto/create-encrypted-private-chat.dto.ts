import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEncryptedPrivateMessageDto {
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
