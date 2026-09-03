import { Injectable } from '@nestjs/common';
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
      include: { role: true, department: true },
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

    return this.prisma.user.create({
      data: {
        authUserId: supabaseUser.id,
        fullName: data.fullName,
        roleId: data.roleId,
        departmentId: data.departmentId || null,
      },
      include: { role: true, department: true },
    });
  }
}
