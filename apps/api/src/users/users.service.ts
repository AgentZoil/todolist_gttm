import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../auth/supabase.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        isActive: true,
        role: { select: { id: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    email: string;
    fullName: string;
    password: string;
    roleId: string;
    departmentId?: string;
  }) {
    const supabaseUser = await this.supabase.getOrCreateUser(
      data.email,
      data.fullName,
      data.password,
    );
    const role = await this.prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');

    return this.prisma.user.create({
      data: {
        authUserId: supabaseUser.id,
        fullName: data.fullName,
        roleId: data.roleId,
        departmentId: role.name === 'DEPARTMENT_EDITOR' && data.departmentId
          ? data.departmentId
          : null,
      },
      include: { role: true, department: true },
    });
  }
}
