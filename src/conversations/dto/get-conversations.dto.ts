import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetConversationsDto {
	@IsOptional()
	@IsIn(['all', 'groups', 'dms'])
	filter?: 'all' | 'groups' | 'dms' = 'all';

	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	limit = 20;
}
