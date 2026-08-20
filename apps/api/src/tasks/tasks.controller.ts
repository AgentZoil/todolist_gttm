import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('tasks')
@UseGuards(AuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async findAll(@Query('departmentId') departmentId: string) {
    const tasks = await this.tasksService.findAll(departmentId);
    return { data: tasks };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const task = await this.tasksService.findOne(id);
    return { data: task };
  }

  @Post()
  async create(
    @Body()
    body: {
      content: string;
      source: string;
      assignedDate: string;
      assignedBy: string;
      documentNumber?: string;
      ownerDepartmentId: string;
      requiredCompletionDate?: string;
      coordinatingDepartmentIds?: string[];
    },
    @CurrentUser() user: { id: string },
  ) {
    const task = await this.tasksService.create({
      ...body,
      createdBy: user.id,
    });
    return { data: task };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      content?: string;
      source?: string;
      assignedDate?: string;
      assignedBy?: string;
      documentNumber?: string;
      ownerDepartmentId?: string;
      requiredCompletionDate?: string;
      actualCompletionDate?: string;
      completionEvidence?: string;
    },
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
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
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
}
