import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async create(data: { code: string; name: string; createdBy: string }) {
    return this.prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: { code: data.code, name: data.name },
      });
      await tx.auditLog.create({
        data: {
          userId: data.createdBy,
          action: 'CREATE_DEPARTMENT',
          entityType: 'DEPARTMENT',
          entityId: department.id,
          fieldName: 'snapshot',
          newValue: JSON.stringify(department),
        },
      });
      return department;
    });
  }

  async update(id: string, data: { name?: string; isActive?: boolean }, updatedBy: string) {
    if (data.name === undefined && data.isActive === undefined) {
      throw new BadRequestException('Cần cung cấp thay đổi phòng ban');
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.department.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Không tìm thấy phòng ban');
      if (
        (data.name === undefined || data.name === before.name) &&
        (data.isActive === undefined || data.isActive === before.isActive)
      ) {
        return before;
      }
      const department = await tx.department.update({ where: { id }, data });
      const changes = (['name', 'isActive'] as const).flatMap((fieldName) =>
        before[fieldName] === department[fieldName]
          ? []
          : [{
              userId: updatedBy,
              action: 'UPDATE_DEPARTMENT',
              entityType: 'DEPARTMENT',
              entityId: id,
              fieldName,
              oldValue: String(before[fieldName]),
              newValue: String(department[fieldName]),
            }],
      );
      if (changes.length) await tx.auditLog.createMany({ data: changes });
      return department;
    });
  }
}
