import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.auditLog.findMany({
      include: {
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
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
