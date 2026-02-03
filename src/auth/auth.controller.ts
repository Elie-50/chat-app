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
import { SignupDto } from './dto/signup-dto';
import { LoginDto } from './dto/login-dto';

@Controller('api/auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@HttpCode(HttpStatus.CREATED)
	@Post('sign-up')
	async signUp(
		@Body() body: SignupDto,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.authService.signUp(body, res);
	}

	@HttpCode(HttpStatus.OK)
	@Post('login')
	async login(
		@Body() body: LoginDto,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.authService.login(body, res);
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
