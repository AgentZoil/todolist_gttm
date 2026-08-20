import { Module } from '@nestjs/common';
import { PeriodLockController } from './period-lock.controller';
import { PeriodLockService } from './period-lock.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PeriodLockController],
  providers: [PeriodLockService],
  exports: [PeriodLockService],
})
export class PeriodLockModule {}
