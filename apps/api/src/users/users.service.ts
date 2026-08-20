import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: { role: true, department: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { authUserId: string; fullName: string; roleId: string; departmentId: string }) {
    return this.prisma.user.create({
      data,
      include: { role: true, department: true },
    });
  }
}
