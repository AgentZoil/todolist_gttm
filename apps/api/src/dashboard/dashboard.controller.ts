import { Controller, Get } from '@nestjs/common';

@Controller('dashboard')
export class DashboardController {
  @Get('summary')
  getSummary() {
    return { status: 'ok', module: 'dashboard', data: {} };
  }

  @Get('departments')
  getDepartments() {
    return { status: 'ok', module: 'dashboard', data: [] };
  }
}
