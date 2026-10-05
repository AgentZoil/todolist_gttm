import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('audit-logs')
@UseGuards(AuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles('ADMIN')
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.auditLogService.findAll(Number(page), Number(limit));
    return {
      data: result.data,
      meta: { total: result.total, page: result.page, limit: result.limit },
    };
  }

  @Get(':id')
  @Roles('ADMIN')
  async findOne(@Param('id') id: string) {
    const log = await this.auditLogService.findOne(id);
    return { data: log };
  }
}
