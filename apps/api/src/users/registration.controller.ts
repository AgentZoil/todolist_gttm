import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterUserDto } from './dto/registration.dto';

@Controller('users')
export class RegistrationController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() body: RegisterUserDto) {
    return { data: await this.usersService.register(body) };
  }
}
