import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { CurrentUser as CurrentUserType } from './current-user.middleware';
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
  async getMe(@CurrentUser() user: CurrentUserType) {
    let departmentName: string | undefined;
    if (user.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: user.departmentId },
        select: { name: true },
      });
      departmentName = department?.name;
    }
    return {
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        departmentId: user.departmentId,
        departmentName,
      },
    };
  }

  @Get('roles')
  async getRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
    return { data: roles };
  }
}
