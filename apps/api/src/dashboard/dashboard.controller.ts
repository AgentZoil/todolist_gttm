import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Query('month') month?: string) {
    const summary = await this.dashboardService.getSummary(month);
    return { data: summary };
  }

  @Get('departments')
  async getDepartments(@Query('month') month?: string) {
    const departments = await this.dashboardService.getDepartments(month);
    return { data: departments };
  }
}
