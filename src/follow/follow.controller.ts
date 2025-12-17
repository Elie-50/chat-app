import {
	Controller,
	Get,
	Post,
	Body,
	Param,
	Delete,
	UseGuards,
	Req,
	HttpCode,
	HttpStatus,
	Query,
} from '@nestjs/common';
import { FollowService } from './follow.service';
import { type AuthenticatedRequest, AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/follow')
export class FollowController {
	constructor(private readonly followService: FollowService) {}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	follow(@Req() req: AuthenticatedRequest, @Body() body: { id: string }) {
		return this.followService.followUser(req.user!._id, body.id);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(':userId')
	unfollow(@Req() req: AuthenticatedRequest, @Param('userId') userId: string) {
		return this.followService.unfollowUser(req.user!._id, userId);
	}

	@Get('followers/:userId')
	getFollowers(
		@Param('userId') userId: string,
		@Query('page') page?: string,
		@Query('size') size?: string,
	) {
		return this.followService.getFollowers(
			userId,
			Number(page) || 1,
			Number(size) || 10,
		);
	}

	@Get('following/:userId')
	getFollowing(
		@Param('userId') userId: string,
		@Query('page') page?: string,
		@Query('size') size?: string,
	) {
		return this.followService.getFollowing(
			userId,
			Number(page) || 1,
			Number(size) || 10,
		);
	}

	@Get('me/followers')
	getMyFollowers(
		@Req() req: AuthenticatedRequest,
		@Query('page') page?: string,
		@Query('size') size?: string,
	) {
		return this.followService.getFollowers(
			req.user!._id,
			Number(page) || 1,
			Number(size) || 10,
		);
	}

	@Get('me/following')
	getMyFollowing(
		@Req() req: AuthenticatedRequest,
		@Query('page') page?: string,
		@Query('size') size?: string,
	) {
		return this.followService.getFollowing(
			req.user!._id,
			Number(page) || 1,
			Number(size) || 10,
		);
	}
}
