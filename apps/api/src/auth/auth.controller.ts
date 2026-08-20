import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('status')
  getStatus() {
    return { status: 'ok', module: 'auth' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe() {
    return { status: 'authenticated' };
  }

  @Get('roles')
  async getRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
    return { data: roles };
  }
}
