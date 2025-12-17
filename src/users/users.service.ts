import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { FilterQuery, Model } from 'mongoose';
import { JwtPayload } from '../auth/auth.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
	constructor(
		@InjectModel(User.name) private readonly userModel: Model<User>,
	) {}

	async create(email: string): Promise<UserDocument | null> {
		return this.userModel.create({ email });
	}

	update(id: string, updateUserDto: UpdateUserDto) {
		return this.userModel
			.findByIdAndUpdate({ _id: id }, updateUserDto, { new: true })
			.exec();
	}

	async findOneWithEmail(email: string): Promise<UserDocument | null> {
		const user = await this.userModel.findOne({ email: email }).exec();
		return user;
	}

	async delete(id: string): Promise<User> {
		const user = await this.userModel.findByIdAndDelete({ _id: id }).exec();

		if (!user) {
			throw new NotFoundException('User not found');
		}

		return user;
	}

	async findByEmailAndVerify(
		email: string,
		verificationCode: string,
	): Promise<JwtPayload> {
		const user = await this.userModel.findOne({ email, verificationCode });

		if (!user) {
			throw new BadRequestException('Invalid verification code');
		}

		const now = new Date();
		if (!user.verificationDue || user.verificationDue < now) {
			throw new BadRequestException('Verification code has expired');
		}

		user.verificationCode = '';
		user.verificationDue = undefined;
		await user.save();

		const { username, _id } = user;
		return { username, email, _id: _id.toString() };
	}

	async findOrCreate(email: string): Promise<User> {
		let user: UserDocument | null = await this.findOneWithEmail(email);

		if (!user) {
			user = await this.create(email);
		}

		if (!user) {
			throw new InternalServerErrorException('Unexpected Error occured');
		}

		user.verificationCode = this.generateRandomSixDigitNumber();
		user.verificationDue = new Date(Date.now() + 2 * 3600 * 1000);

		await user.save();

		return user;
	}

	private generateRandomSixDigitNumber(): string {
		return (Math.floor(Math.random() * 900000) + 100000).toString();
	}

	async searchByUsername(
		username: string,
		page: number = 1,
		size: number = 10,
		currentUserId: string,
	) {
		if (!username) {
			return {
				data: [],
				page,
				size,
				total: 0,
				totalPages: 0,
			};
		}

		const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

		const filter: FilterQuery<UserDocument> = {
			username: {
				$regex: escaped,
				$options: 'i',
			},
			_id: { $ne: currentUserId },
		};

		const limit = Math.min(size, 50);
		const skip = (page - 1) * limit;

		const [data, total] = await Promise.all([
			this.userModel
				.find(filter)
				.select('username')
				.skip(skip)
				.limit(limit)
				.lean(),

			this.userModel.countDocuments(filter),
		]);

		return {
			data,
			page,
			size: limit,
			total,
			totalPages: Math.ceil(total / limit),
		};
	}
}
