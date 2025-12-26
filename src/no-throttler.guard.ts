/* eslint-disable @typescript-eslint/no-unused-vars */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class NoThrottlerGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		return true;
	}
}
