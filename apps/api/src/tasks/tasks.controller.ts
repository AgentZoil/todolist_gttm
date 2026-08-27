import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Controller('tasks')
@UseGuards(AuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async findAll(
    @Query('departmentId') departmentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('assignedBy') assignedBy?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const result = await this.tasksService.findAll({
      departmentId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      dateFrom,
      dateTo,
      assignedBy,
      sortBy,
      sortOrder,
    });
    return result;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const task = await this.tasksService.findOne(id);
    return { data: task };
  }

  @Post()
  async create(
    @Body() body: CreateTaskDto,
    @CurrentUser() user: { id: string; role: string; departmentId: string },
  ) {
    const task = await this.tasksService.create({
      ...body,
      ownerDepartmentId: ['ADMIN', 'SECRETARY'].includes(user.role)
        ? body.ownerDepartmentId
        : user.departmentId,
      createdBy: user.id,
    });
    return { data: task };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateTaskDto,
    @CurrentUser() user: { id: string; role: string; departmentId: string },
  ) {
    if (!['ADMIN', 'SECRETARY'].includes(user.role)) {
      const canEdit = await this.tasksService.findOne(id);
      if (canEdit && canEdit.ownerDepartmentId !== user.departmentId) {
        throw new ForbiddenException('Bạn không có quyền sửa nhiệm vụ này');
      }
    }

    const task = await this.tasksService.update(id, {
      ...body,
      updatedBy: user.id,
      userRole: user.role,
    });
    return { data: task };
  }

  @Patch(':id/cancel')
  @Roles('ADMIN', 'SECRETARY')
  async cancel(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const task = await this.tasksService.cancel(id, user.id);
    return { data: task };
  }

  @Patch(':id/finalize')
  async finalize(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const task = await this.tasksService.finalize(id, user.id, user.role);
    return { data: task };
  }

  @Patch(':id/unfinalize')
  @Roles('ADMIN')
  async unfinalize(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const task = await this.tasksService.unfinalize(id, user.id);
    return { data: task };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const result = await this.tasksService.remove(id, user.id, user.role);
    return result;
  }
}
