import {
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { UpdateUserDto } from '../users/dto/update-user.dto';

export interface JwtPayload {
	_id: string;
	username?: string;
	email: string;
}

interface ExtendedJwtPayload extends JwtPayload {
	iat: number;
	exp: number;
}

@Injectable()
export class AuthService {
	constructor(
		private readonly emailService: EmailService,
		private readonly userService: UsersService,
		private readonly jwtService: JwtService,
	) {}

	async requestCode(email: string) {
		const user = await this.userService.findOrCreate(email);

		if (!user) {
			throw new InternalServerErrorException('Unexpected Error Occured');
		}

		await this.emailService.sendVerificationCode(user.verificationCode, email);

		return { message: 'Email sent successfully' };
	}

	async verify(email: string, code: string, res: Response) {
		const user = await this.userService.findByEmailAndVerify(email, code);

		if (!user) {
			throw new NotFoundException('No Account with the given email were found');
		}

		const payload: JwtPayload = {
			_id: user._id.toString(),
			email: user.email,
			username: user.username,
		};

		const { accessToken } = await this.generateTokens(payload, res);

		return { user, accessToken };
	}

	async generateTokens(payload: JwtPayload, res: Response) {
		const accessToken = await this.jwtService.signAsync(payload, {
			secret: process.env.JWT_SECRET!,
			expiresIn: '15m',
		});

		const refreshToken = await this.jwtService.signAsync(payload, {
			expiresIn: '7d',
			secret: process.env.JWT_REFRESH_SECRET!,
		});

		res.cookie('refresh_token', refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			path: '/',
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		return { accessToken };
	}

	async refreshTokens(req: Request, res: Response) {
		const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

		if (!refreshToken) {
			throw new UnauthorizedException('No refresh token found');
		}
		try {
			const payload: ExtendedJwtPayload = await this.jwtService.verifyAsync(
				refreshToken,
				{
					secret: process.env.JWT_REFRESH_SECRET,
				},
			);

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { iat, exp, ...cleanPayload } = payload;

			const { accessToken } = await this.generateTokens(cleanPayload, res);

			return { accessToken, user: cleanPayload as JwtPayload };
		} catch {
			throw new UnauthorizedException('Invalid refresh token');
		}
	}

	logout(res: Response) {
		res.clearCookie('refresh_token', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			path: '/',
		});

		return { message: 'Logged out successfully' };
	}

	async update(
		id: string,
		updateUserDto: UpdateUserDto,
		res: Response,
	): Promise<{ user: JwtPayload; accessToken: string }> {
		const user = await this.userService.update(id, updateUserDto);

		if (!user) {
			throw new NotFoundException('User not found');
		}
		const { _id, email, username } = user;

		const payload = { _id: _id.toString(), email, username };
		const { accessToken } = await this.generateTokens(payload, res);

		return { user: payload, accessToken };
	}
}
