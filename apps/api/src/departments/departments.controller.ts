import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('departments')
@UseGuards(AuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async findAll() {
    const departments = await this.departmentsService.findAll();
    return { data: departments };
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() body: { code: string; name: string }) {
    const department = await this.departmentsService.create(body);
    return { data: department };
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
  ) {
    const department = await this.departmentsService.update(id, body);
    return { data: department };
  }
}
