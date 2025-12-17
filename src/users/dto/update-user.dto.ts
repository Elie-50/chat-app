export class UpdateUserDto {
	readonly verificationCode?: string;
	readonly verificationDue?: Date;
	readonly username?: string;
}
