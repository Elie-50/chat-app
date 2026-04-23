import { PartialType } from '@nestjs/mapped-types';
import { CreateEncryptedPrivateMessageDto } from './create-encrypted-private-chat.dto';

export class UpdateEncryptedPrivateMessageDto extends PartialType(
	CreateEncryptedPrivateMessageDto,
) {}
