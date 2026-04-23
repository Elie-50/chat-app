import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { MailService } from 'src/mail/mail.service';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login-dto';
import { SignupDto } from './dto/signup-dto';

export interface JwtPayload {
	_id: string;
	username: string;
}

interface ExtendedJwtPayload extends JwtPayload {
	iat: number;
	exp: number;
}

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UsersService,
		private readonly jwtService: JwtService,
		private readonly mailService: MailService,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {}

	/** Saves a code and link it to a user in redis store to authenticate via email */
	async requestCode(email: string) {
		const user = await this.userService.findOrCreateWithEmail(email);

		const code = Math.floor(100000 + Math.random() * 900000).toString();

		const hashedOtp = await bcrypt.hash(code, 10);

		await this.redis.set(`otp:${user._id.toString()}`, hashedOtp, 'EX', 600);

		await this.mailService.sendOtp(email, code);

		return { message: 'OTP sent successfully' };
	}

	/** Verify a user code from the redis store */
	async verifyCode(email: string, code: string, res: Response) {
		const user = await this.userService.findOneWithEmail(email);
		if (!user) {
			throw new UnauthorizedException('Invalid credentials');
		}

		const storedOtp = await this.redis.get(`otp:${user._id.toString()}`);
		if (!storedOtp) {
			throw new UnauthorizedException('OTP expired');
		}

		const isValid = await bcrypt.compare(code, storedOtp);
		if (!isValid) {
			throw new UnauthorizedException('Invalid OTP');
		}

		await this.redis.del(`otp:${user._id.toString()}`);

		const payload = {
			_id: user._id.toString(),
			username: user.username,
		};

		const tokens = await this.generateTokens(payload, res);

		return {
			user: payload,
			accessToken: tokens.accessToken,
		};
	}

	async login(dto: LoginDto, res: Response) {
		const user = await this.userService.findOneWithEmail(dto.email);

		if (!user) {
			throw new BadRequestException('Invalid credentials');
		}
		const validPassword = await bcrypt.compare(dto.password, user.password);
		if (!validPassword) {
			throw new BadRequestException('Invalid credentials');
		}

		const payload: JwtPayload = {
			_id: user._id.toString(),
			username: user.username,
		};

		const tokens = await this.generateTokens(payload, res);

		return {
			user: payload,
			accessToken: tokens.accessToken,
		};
	}

	async signUp(dto: SignupDto, res: Response) {
		const user = await this.userService.findOneWithUsernameOrEmail(
			dto.username,
			dto.email,
		);

		if (user) {
			throw new BadRequestException('Username already exists');
		}
		const saltRounds = 10;
		const salt = await bcrypt.genSalt(saltRounds);
		const hashedPassword = await bcrypt.hash(dto.password, salt);
		const newUser = await this.userService.create({
			username: dto.username,
			email: dto.email,
			password: hashedPassword,
		});

		if (!newUser) {
			throw new BadRequestException('Failed to create accoung');
		}

		const payload: JwtPayload = {
			_id: newUser._id.toString(),
			username: newUser.username,
		};

		const tokens = await this.generateTokens(payload, res);

		return {
			user: payload,
			accessToken: tokens.accessToken,
		};
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

			const user = await this.userService.findOne(payload._id);
			cleanPayload.username = user.username;
			if (!user) {
				throw new UnauthorizedException('Account does not exist');
			}

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
		const { _id, username } = user;

		const payload = { _id: _id.toString(), username };
		const { accessToken } = await this.generateTokens(payload, res);

		return { user: payload, accessToken };
	}
}
