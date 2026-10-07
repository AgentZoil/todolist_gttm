import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 50) {
    const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, 1_000) : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 100)
      : 50;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { data, total, page: safePage, limit: safeLimit };
  }

  async findOne(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });
  }
}
