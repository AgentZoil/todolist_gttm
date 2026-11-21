import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../auth/current-user.type';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import type { Response } from 'express';

@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'SECRETARY', 'DEPARTMENT_EDITOR')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Export route phải đứng TRƯỚC route động để NestJS match đúng
  @Get('tasks/export')
  async exportExcel(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    return this.reportsService.exportExcel(query, user, res);
  }

  @Get('tasks')
  async getReportData(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.reportsService.getReportData(query, user);
  }
}
