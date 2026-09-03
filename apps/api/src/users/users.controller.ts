import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return { data: users };
  }

  @Post()
  @Roles('ADMIN')
  async create(
    @Body()
    body: {
      email: string;
      fullName: string;
      password: string;
      roleId: string;
      departmentId?: string;
    },
  ) {
    const user = await this.usersService.create(body);
    return { data: user };
  }
}
