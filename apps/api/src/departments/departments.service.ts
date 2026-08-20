import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async create(data: { code: string; name: string }) {
    return this.prisma.department.create({
      data,
    });
  }

  async update(id: string, data: { name?: string; isActive?: boolean }) {
    return this.prisma.department.update({
      where: { id },
      data,
    });
  }
}
