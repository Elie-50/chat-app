import { PartialType } from '@nestjs/mapped-types';
import { CreatePrivateMessageDto } from './create-private-chat.dto';

export class UpdatePrivateMessageDto extends PartialType(
	CreatePrivateMessageDto,
) {}
