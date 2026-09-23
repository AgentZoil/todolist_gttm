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
    return this.prisma.periodLock.upsert({
      where: { year_month: { year, month } },
      update: { lockedBy, lockedAt: new Date() },
      create: { year, month, lockedBy, lockedAt: new Date() },
    });
  }

  async unlockPeriod(year: number, month: number) {
    this.validatePeriod(year, month);
    const lock = await this.prisma.periodLock.findUnique({
      where: { year_month: { year, month } },
    });
    if (!lock) throw new NotFoundException(`Period ${year}-${month} not found`);
    return this.prisma.periodLock.delete({
      where: { year_month: { year, month } },
    });
  }

  private validatePeriod(year: number, month: number) {
    if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Năm hoặc tháng không hợp lệ');
    }
  }
}
