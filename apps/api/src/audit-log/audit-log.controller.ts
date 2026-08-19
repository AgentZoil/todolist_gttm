import { Controller, Get } from '@nestjs/common';

@Controller('audit-logs')
export class AuditLogController {
  @Get()
  findAll() {
    return { status: 'ok', module: 'audit-logs', data: [] };
  }
}
