import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  authUserId: string;
  email: string;
}

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
      user?: AuthUser;
      currentUser?: CurrentUser;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const { data, error } = await this.supabase
      .getClient()
      .auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = {
      authUserId: data.user.id,
      email: data.user.email ?? '',
    } satisfies AuthUser;

    const user = await this.prisma.user.findUnique({
      where: { authUserId: data.user.id },
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

    request.currentUser = {
      id: user.id,
      authUserId: user.authUserId,
      email: data.user.email ?? '',
      fullName: user.fullName,
      roleId: user.roleId,
      departmentId: user.departmentId,
      role: user.role.name,
      isActive: user.isActive,
    };

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
