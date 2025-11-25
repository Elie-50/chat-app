export class CreateUserDto {
  readonly email: string;
  readonly verificationCode: string;
  readonly verificationDue: Date;
}
