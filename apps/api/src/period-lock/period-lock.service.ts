import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PeriodLockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.periodLock.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async isPeriodLocked(year: number, month: number): Promise<boolean> {
    const lock = await this.prisma.periodLock.findUnique({
      where: { year_month: { year, month } },
    });
    return !!lock;
  }

  async lockPeriod(year: number, month: number, lockedBy: string) {
    this.validatePeriod(year, month);
    return this.prisma.$transaction(async (tx) => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const before = await tx.periodLock.findUnique({ where: { year_month: { year, month } } });
      const now = new Date();
      const lock = await tx.periodLock.upsert({
        where: { year_month: { year, month } },
        update: { lockedBy, lockedAt: now },
        create: { year, month, lockedBy, lockedAt: now },
      });
      await tx.auditLog.create({
        data: {
          userId: lockedBy,
          action: 'LOCK_PERIOD',
          entityType: 'PERIOD_LOCK',
          entityId: key,
          fieldName: 'lock',
          oldValue: before ? JSON.stringify(before) : null,
          newValue: JSON.stringify(lock),
        },
      });
      return lock;
    });
  }

  async unlockPeriod(year: number, month: number, unlockedBy: string) {
    this.validatePeriod(year, month);
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.periodLock.findUnique({
        where: { year_month: { year, month } },
      });
      if (!lock) throw new NotFoundException(`Period ${year}-${month} not found`);
      await tx.periodLock.delete({ where: { year_month: { year, month } } });
      await tx.auditLog.create({
        data: {
          userId: unlockedBy,
          action: 'UNLOCK_PERIOD',
          entityType: 'PERIOD_LOCK',
          entityId: `${year}-${String(month).padStart(2, '0')}`,
          fieldName: 'lock',
          oldValue: JSON.stringify(lock),
          newValue: null,
        },
      });
      return lock;
    });
  }

  private validatePeriod(year: number, month: number) {
    if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Năm hoặc tháng không hợp lệ');
    }
  }
}
