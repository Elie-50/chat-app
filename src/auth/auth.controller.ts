import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Patch,
	Post,
	Req,
	Res,
	UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { type AuthenticatedRequest, AuthGuard } from './auth.guard';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@Controller('api/auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('request-code')
	requestCode(@Body() body: { email: string }) {
		return this.authService.requestCode(body.email);
	}

	@Post('verify')
	async verifyEmail(
		@Body() body: { email: string; code: string },
		@Res({ passthrough: true }) res: Response,
	) {
		const { user, accessToken } = await this.authService.verify(
			body.email,
			body.code,
			res,
		);

		return { user, accessToken };
	}

	@HttpCode(HttpStatus.OK)
	@Post('refresh')
	async refresh(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.authService.refreshTokens(req, res);
	}

	@HttpCode(HttpStatus.OK)
	@Post('logout')
	logout(@Res({ passthrough: true }) res: Response) {
		return this.authService.logout(res);
	}

	@Patch('me')
	@UseGuards(AuthGuard)
	update(
		@Body() updateUserDto: UpdateUserDto,
		@Req() req: AuthenticatedRequest,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.authService.update(req.user!._id, updateUserDto, res);
	}
}
