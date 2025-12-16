import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  async searchUsers(
    @Query('username') username: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.usersService.searchByUsername(
      username,
      Number(page) || 1,
      Number(size) || 10,
    );
  }
}
