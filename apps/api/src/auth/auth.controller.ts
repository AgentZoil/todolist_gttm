import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  @Get('status')
  getStatus() {
    return { status: 'ok', module: 'auth' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe() {
    return { status: 'authenticated' };
  }
}
