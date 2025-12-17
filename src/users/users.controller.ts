import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { type AuthenticatedRequest, AuthGuard } from '../auth/auth.guard';

@Controller('api/users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@UseGuards(AuthGuard)
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
}
