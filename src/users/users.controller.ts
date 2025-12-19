import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
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
}
