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
import type { Request, Response } from 'express';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { type AuthenticatedRequest, AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login-dto';
import { RequestCodeDto } from './dto/request-code.dto';
import { SignupDto } from './dto/signup-dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { RefreshDto } from './dto/refresh.dto';

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
	@Post('request-code')
	async requestCode(@Body() body: RequestCodeDto) {
		return this.authService.requestCode(body.email);
	}

	@HttpCode(HttpStatus.OK)
	@Post('verify-code')
	async verifyCode(
		@Body() body: VerifyCodeDto,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.authService.verifyCode(body.email, body.code, res);
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
		@Body() body: RefreshDto,
	) {
		return this.authService.refreshTokens(req, res, body.refreshToken);
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
