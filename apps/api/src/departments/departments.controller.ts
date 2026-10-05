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
import { CurrentUser } from '../auth/current-user.decorator';

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
  async create(
    @Body() body: { code: string; name: string },
    @CurrentUser() user: { id: string },
  ) {
    const department = await this.departmentsService.create({ ...body, createdBy: user.id });
    return { data: department };
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
    @CurrentUser() user: { id: string },
  ) {
    const department = await this.departmentsService.update(id, body, user.id);
    return { data: department };
  }
}
