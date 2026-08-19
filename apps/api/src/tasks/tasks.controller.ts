import { Controller, Get } from '@nestjs/common';

@Controller('tasks')
export class TasksController {
  @Get()
  findAll() {
    return { status: 'ok', module: 'tasks', data: [] };
  }
}
