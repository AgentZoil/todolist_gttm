import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth.guard';

export interface CurrentUser {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  roleId: string;
  departmentId: string;
  role: string;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser;
    }
  }
}

@Injectable()
export class CurrentUserMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: any, _res: any, next: () => void) {
    const authUser: AuthUser | undefined = req.user;

    if (!authUser) {
      return next();
    }

    const user = await this.prisma.user.findUnique({
      where: { authUserId: authUser.authUserId },
      include: { role: true },
    });

    if (!user) {
      throw new ForbiddenException(
        'Tài khoản chưa được cấp quyền trong hệ thống',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');
    }

    req.currentUser = {
      id: user.id,
      authUserId: user.authUserId,
      email: authUser.email,
      fullName: user.fullName,
      roleId: user.roleId,
      departmentId: user.departmentId,
      role: user.role.name,
      isActive: user.isActive,
    };

    next();
  }
}
