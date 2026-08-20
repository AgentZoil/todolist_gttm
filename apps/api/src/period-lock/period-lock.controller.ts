import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { PeriodLockService } from './period-lock.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('period-locks')
@UseGuards(AuthGuard, RolesGuard)
export class PeriodLockController {
  constructor(private readonly periodLockService: PeriodLockService) {}

  @Get()
  async findAll() {
    const locks = await this.periodLockService.findAll();
    return { data: locks };
  }

  @Post(':year/:month')
  @Roles('ADMIN')
  async lock(
    @Param('year') year: string,
    @Param('month') month: string,
    @CurrentUser() user: { id: string },
  ) {
    const lock = await this.periodLockService.lockPeriod(
      parseInt(year),
      parseInt(month),
      user.id,
    );
    return { data: lock };
  }

  @Delete(':year/:month')
  @Roles('ADMIN')
  async unlock(
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    await this.periodLockService.unlockPeriod(parseInt(year), parseInt(month));
    return { message: 'Unlocked' };
  }
}
