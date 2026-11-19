import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import type { Response } from 'express';

@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Export route phải đứng TRƯỚC route động để NestJS match đúng
  @Get('tasks/export')
  @Roles('ADMIN')
  async exportExcel(@Query() query: ReportQueryDto, @Res() res: Response) {
    return this.reportsService.exportExcel(query, res);
  }

  @Get('tasks')
  @Roles('ADMIN')
  async getReportData(@Query() query: ReportQueryDto) {
    return this.reportsService.getReportData(query);
  }
}
