import { Controller, Get } from '@nestjs/common';

@Controller('period-locks')
export class PeriodLockController {
  @Get()
  findAll() {
    return { status: 'ok', module: 'period-locks', data: [] };
  }
}
