import { Module } from '@nestjs/common';
import { PeriodLockController } from './period-lock.controller';
import { PeriodLockService } from './period-lock.service';

@Module({
  controllers: [PeriodLockController],
  providers: [PeriodLockService],
  exports: [PeriodLockService],
})
export class PeriodLockModule {}
