import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import {
  RegisterUserDto,
  RequestPasswordResetDto,
} from './dto/registration.dto';

@Controller('users')
export class RegistrationController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() body: RegisterUserDto) {
    return { data: await this.usersService.register(body) };
  }

  @Post('password-reset-requests')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return { data: await this.usersService.requestPasswordReset(body.email) };
  }
}
