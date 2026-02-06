import {
	Body,
	Controller,
	Get,
	Header,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { type AuthenticatedRequest, AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get('search')
	async searchUsers(
		@Query('username') username: string,
		@Req() req: AuthenticatedRequest,
		@Query('page') page?: string,
		@Query('size') size?: string,
	) {
		return this.usersService.searchByUsername(
			username,
			Number(page) || 1,
			Number(size) || 10,
			req.user!._id,
		);
	}

	@Get(':userId')
	findOne(@Param('userId') userId: string) {
		return this.usersService.findOne(userId);
	}

	@Header('Cache-Control', 'public, max-age=31536000, immutable')
	@Get(':userId/public-keys')
	findUsersKeys(@Param('userId') userId: string) {
		return this.usersService.findUsersKeys(userId);
	}

	@Post('keys')
	async uploadKeys(
		@Req() req: AuthenticatedRequest,
		@Body()
		body: {
			identityPublicKey: string;
			exchangePublicKey: string;
		},
	) {
		return this.usersService.storeKeys(req.user!._id, body);
	}
}
