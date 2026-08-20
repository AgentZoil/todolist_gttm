import { Injectable, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PeriodLockService } from '../period-lock/period-lock.service';
import { calculateTaskStatus, getStatusLabel, getStatusColor } from './status';

const NHOM_A_FIELDS = [
  'content', 'source', 'assignedDate', 'assignedBy',
  'documentNumber', 'ownerDepartmentId', 'requiredCompletionDate',
];

const NHOM_B_FIELDS = ['actualCompletionDate', 'completionEvidence'];

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly periodLockService: PeriodLockService,
  ) {}

  private enrichTask(task: any) {
    const status = calculateTaskStatus({
      isCancelled: task.isCancelled,
      requiredCompletionDate: task.requiredCompletionDate,
      actualCompletionDate: task.actualCompletionDate,
    });
    return {
      ...task,
      status,
      statusLabel: getStatusLabel(status),
      statusColor: getStatusColor(status),
    };
  }

  async findAll(params: {
    departmentId?: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const {
      departmentId,
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = {};
    if (departmentId) where.ownerDepartmentId = departmentId;
    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { taskCode: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      if (status === 'IN_PROGRESS') {
        where.isCancelled = false;
        where.actualCompletionDate = null;
      } else if (status === 'COMPLETED') {
        where.isCancelled = false;
        where.actualCompletionDate = { not: null };
      } else if (status === 'CANCELLED') {
        where.isCancelled = true;
      }
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: {
          id: true,
          taskCode: true,
          title: true,
          content: true,
          source: true,
          assignedDate: true,
          assignedBy: true,
          documentNumber: true,
          coordinatingUnits: true,
          requiredCompletionDate: true,
          actualCompletionDate: true,
          isCancelled: true,
          isFinalized: true,
          version: true,
          createdAt: true,
          ownerDepartment: {
            select: { id: true, code: true, name: true },
          },
          creator: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks.map((task) => this.enrichTask(task)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        taskCode: true,
        title: true,
        content: true,
        source: true,
        requiredCompletionDate: true,
        actualCompletionDate: true,
        completionEvidence: true,
        coordinatingUnits: true,
        isCancelled: true,
        cancelledAt: true,
        cancelledBy: true,
        isFinalized: true,
        finalizedAt: true,
        finalizedBy: true,
        version: true,
        createdBy: true,
        updatedBy: true,
        createdAt: true,
        updatedAt: true,
        ownerDepartment: {
          select: { id: true, code: true, name: true },
        },
        creator: {
          select: { id: true, fullName: true },
        },
        updater: {
          select: { id: true, fullName: true },
        },
        coordinatingDepts: {
          select: {
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    return task ? this.enrichTask(task) : null;
  }

  async create(data: {
    title: string;
    content: string;
    source: string;
    assignedDate: string;
    assignedBy: string;
    documentNumber?: string;
    coordinatingUnits?: string;
    ownerDepartmentId: string;
    requiredCompletionDate?: string;
    createdBy: string;
  }) {
    const taskCode = `NV-${Date.now()}`;

    return this.prisma.task.create({
      data: {
        taskCode,
        title: data.title,
        content: data.content,
        source: data.source,
        assignedDate: new Date(data.assignedDate),
        assignedBy: data.assignedBy,
        documentNumber: data.documentNumber,
        coordinatingUnits: data.coordinatingUnits,
        ownerDepartmentId: data.ownerDepartmentId,
        requiredCompletionDate: data.requiredCompletionDate
          ? new Date(data.requiredCompletionDate)
          : null,
        createdBy: data.createdBy,
      },
      include: {
        ownerDepartment: true,
      },
    });
  }

  private async checkEditPermissions(
    task: any,
    data: Record<string, any>,
    userRole: string,
  ) {
    if (task.isFinalized && userRole !== 'ADMIN') {
      throw new ForbiddenException('Nhiệm vụ đã được chốt, không thể chỉnh sửa');
    }

    const nhomAKeys = Object.keys(data).filter((k) =>
      NHOM_A_FIELDS.includes(k),
    );
    const nhomBKeys = Object.keys(data).filter((k) =>
      NHOM_B_FIELDS.includes(k),
    );

    if (nhomAKeys.length > 0 && task.requiredCompletionDate) {
      const d = new Date(task.requiredCompletionDate);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const isLocked = await this.periodLockService.isPeriodLocked(year, month);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const isCurrentPeriod = year === currentYear && month === currentMonth;

      if (isLocked && !isCurrentPeriod && userRole !== 'ADMIN') {
        throw new ForbiddenException(
          `Nhóm A đã bị khóa (tháng ${month}/${year}), chỉ Admin mới có quyền chỉnh sửa`,
        );
      }
    }
  }

  async update(
    id: string,
    data: {
      content?: string;
      source?: string;
      assignedDate?: string;
      assignedBy?: string;
      documentNumber?: string;
      ownerDepartmentId?: string;
      requiredCompletionDate?: string;
      actualCompletionDate?: string;
      completionEvidence?: string;
      expectedVersion?: number;
      updatedBy: string;
      userRole: string;
    },
  ) {
    const oldTask = await this.prisma.task.findUnique({ where: { id } });
    if (!oldTask) throw new ForbiddenException('Task not found');

    if (data.expectedVersion !== undefined && data.expectedVersion !== oldTask.version) {
      throw new ConflictException(
        'Nhiệm vụ đã bị thay đổi bởi người khác. Vui lòng tải lại trang.',
      );
    }

    await this.checkEditPermissions(oldTask, data, data.userRole);

    const { userRole, expectedVersion, ...updateData } = data;

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        ...updateData,
        assignedDate: updateData.assignedDate
          ? new Date(updateData.assignedDate)
          : undefined,
        requiredCompletionDate: updateData.requiredCompletionDate
          ? new Date(updateData.requiredCompletionDate)
          : undefined,
        actualCompletionDate: updateData.actualCompletionDate
          ? new Date(updateData.actualCompletionDate)
          : undefined,
        version: { increment: 1 },
      },
      include: {
        ownerDepartment: true,
        coordinatingDepts: { include: { department: true } },
      },
    });

    const fieldsToTrack = [
      'content', 'source', 'assignedDate', 'assignedBy',
      'documentNumber', 'ownerDepartmentId', 'requiredCompletionDate',
      'actualCompletionDate', 'completionEvidence',
    ];

    for (const field of fieldsToTrack) {
      const oldValue = oldTask?.[field as keyof typeof oldTask];
      const newValue = updatedTask[field as keyof typeof updatedTask];
      const oldStr = oldValue instanceof Date ? oldValue.toISOString() : String(oldValue ?? '');
      const newStr = newValue instanceof Date ? newValue.toISOString() : String(newValue ?? '');

      if (oldStr !== newStr) {
        await this.auditLogService.log({
          userId: data.updatedBy,
          action: 'UPDATE',
          entityType: 'TASK',
          entityId: id,
          fieldName: field,
          oldValue: oldStr,
          newValue: newStr,
        });
      }
    }

    return updatedTask;
  }

  async cancel(id: string, cancelledBy: string) {
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledBy,
      },
      include: {
        ownerDepartment: true,
        coordinatingDepts: { include: { department: true } },
      },
    });

    await this.auditLogService.log({
      userId: cancelledBy,
      action: 'CANCEL',
      entityType: 'TASK',
      entityId: id,
    });

    return task;
  }

  async finalize(id: string, finalizedBy: string, userRole: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new ForbiddenException('Task not found');

    if (task.isFinalized) {
      throw new ForbiddenException('Nhiệm vụ đã được chốt');
    }

    if (userRole === 'DEPARTMENT_EDITOR') {
      if (task.ownerDepartmentId !== (await this.getDepartmentId(finalizedBy))) {
        throw new ForbiddenException('Chỉ chủ nhiệm vụ mới được chốt');
      }
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedBy,
      },
      include: {
        ownerDepartment: true,
        coordinatingDepts: { include: { department: true } },
      },
    });

    await this.auditLogService.log({
      userId: finalizedBy,
      action: 'FINALIZE',
      entityType: 'TASK',
      entityId: id,
    });

    return updated;
  }

  async unfinalize(id: string, unfinalizedBy: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new ForbiddenException('Task not found');

    if (!task.isFinalized) {
      throw new ForbiddenException('Nhiệm vụ chưa được chốt');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        isFinalized: false,
        finalizedAt: null,
        finalizedBy: null,
      },
      include: {
        ownerDepartment: true,
        coordinatingDepts: { include: { department: true } },
      },
    });

    await this.auditLogService.log({
      userId: unfinalizedBy,
      action: 'UNFINALIZE',
      entityType: 'TASK',
      entityId: id,
    });

    return updated;
  }

  private async getDepartmentId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    return user?.departmentId ?? '';
  }
}
