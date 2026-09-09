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
import { CreateTaskDto, TaskFeedbackDto, UpdateTaskDto } from './dto/task.dto';

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

  @Get('pending-approval')
  @Roles('ADMIN', 'LEADER', 'SECRETARY')
  async findPendingApprovals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.tasksService.findPendingApprovals({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
  }

  @Get('attention')
  @Roles('DEPARTMENT_EDITOR')
  async findDepartmentAttention(
    @CurrentUser() user: { departmentId?: string | null },
  ) {
    if (!user.departmentId) {
      throw new ForbiddenException('Tài khoản phòng ban chưa được gắn đơn vị');
    }
    return this.tasksService.findDepartmentAttention(user.departmentId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ) {
    const task = await this.tasksService.findOne(id);
    return { data: task };
  }

  @Post()
  async create(
    @Body() body: CreateTaskDto,
    @CurrentUser() user: { id: string; role: string; departmentId: string },
  ) {
    if (!['ADMIN', 'SECRETARY', 'DEPARTMENT_EDITOR'].includes(user.role)) {
      throw new ForbiddenException('Chỉ Thư ký, Admin hoặc đại diện phòng ban được tạo nhiệm vụ');
    }
    if (user.role === 'DEPARTMENT_EDITOR' && !user.departmentId) {
      throw new ForbiddenException('Tài khoản phòng ban chưa được gắn đơn vị');
    }
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

    const updateBody = user.role === 'DEPARTMENT_EDITOR'
      ? {
          ...(body.actualCompletionDate !== undefined && {
            actualCompletionDate: body.actualCompletionDate,
          }),
          ...(body.completionEvidence !== undefined && {
            completionEvidence: body.completionEvidence,
          }),
          ...(body.expectedVersion !== undefined && {
            expectedVersion: body.expectedVersion,
          }),
        }
      : body;

    const task = await this.tasksService.update(id, {
      ...updateBody,
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

  @Patch(':id/approve')
  @Roles('ADMIN', 'LEADER', 'SECRETARY')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const task = await this.tasksService.approve(id, user.id);
    return { data: task };
  }

  @Patch(':id/request-revision')
  @Roles('ADMIN', 'LEADER', 'SECRETARY')
  async requestRevision(
    @Param('id') id: string,
    @Body() body: TaskFeedbackDto,
    @CurrentUser() user: { id: string },
  ) {
    const task = await this.tasksService.requestRevision(id, user.id, body.content);
    return { data: task };
  }

  @Post(':id/directives')
  @Roles('ADMIN', 'LEADER', 'SECRETARY')
  async addDirective(
    @Param('id') id: string,
    @Body() body: TaskFeedbackDto,
    @CurrentUser() user: { id: string },
  ) {
    const feedback = await this.tasksService.addDirective(id, user.id, body.content);
    return { data: feedback };
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
