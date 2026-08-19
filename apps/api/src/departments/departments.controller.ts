import { Controller, Get } from '@nestjs/common';

@Controller('departments')
export class DepartmentsController {
  @Get()
  findAll() {
    return { status: 'ok', module: 'departments', data: [] };
  }
}
