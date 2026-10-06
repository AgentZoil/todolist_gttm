import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../auth/current-user.type';
import {
  ApproveRegistrationDto,
  RejectRegistrationDto,
  UpdateUserDto,
} from './dto/registration.dto';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'SECRETARY')
  async findAll() {
    const users = await this.usersService.findAll();
    return { data: users };
  }

  @Patch(':id')
  @Roles('ADMIN')
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return { data: await this.usersService.updateUser(id, body, user.id) };
  }

  @Delete(':id')
  @Roles('ADMIN')
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return { data: await this.usersService.deleteUser(id, user.id) };
  }

  @Get('registration-requests')
  @Roles('ADMIN')
  async findRegistrationRequests() {
    return { data: await this.usersService.findRegistrationRequests() };
  }

  @Patch('registration-requests/:id/approve')
  @Roles('ADMIN')
  async approveRegistrationRequest(
    @Param('id') id: string,
    @Body() body: ApproveRegistrationDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return {
      data: await this.usersService.approveRegistrationRequest(
        id,
        body,
        user.id,
      ),
    };
  }

  @Patch('registration-requests/:id/reject')
  @Roles('ADMIN')
  async rejectRegistrationRequest(
    @Param('id') id: string,
    @Body() body: RejectRegistrationDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return {
      data: await this.usersService.rejectRegistrationRequest(
        id,
        body.reason,
        user.id,
      ),
    };
  }

  @Get('password-reset-requests')
  @Roles('ADMIN')
  async findPasswordResetRequests() {
    return { data: await this.usersService.findPasswordResetRequests() };
  }

  @Patch('password-reset-requests/:id/approve')
  @Roles('ADMIN')
  async approvePasswordResetRequest(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return {
      data: await this.usersService.approvePasswordResetRequest(id, user.id),
    };
  }

  @Patch('password-reset-requests/:id/reject')
  @Roles('ADMIN')
  async rejectPasswordResetRequest(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return {
      data: await this.usersService.rejectPasswordResetRequest(id, user.id),
    };
  }
}
