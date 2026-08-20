import { Injectable, ForbiddenException } from '@nestjs/common';
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

  async findAll(departmentId?: string) {
    const tasks = await this.prisma.task.findMany({
      where: departmentId ? { ownerDepartmentId: departmentId } : undefined,
      include: {
        ownerDepartment: true,
        creator: { select: { id: true, fullName: true } },
        coordinatingDepts: { include: { department: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return tasks.map((task) => this.enrichTask(task));
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        ownerDepartment: true,
        creator: { select: { id: true, fullName: true } },
        updater: { select: { id: true, fullName: true } },
        coordinatingDepts: { include: { department: true } },
      },
    });
    return task ? this.enrichTask(task) : null;
  }

  async create(data: {
    content: string;
    source: string;
    assignedDate: string;
    assignedBy: string;
    documentNumber?: string;
    ownerDepartmentId: string;
    requiredCompletionDate?: string;
    createdBy: string;
    coordinatingDepartmentIds?: string[];
  }) {
    const taskCode = `NV-${Date.now()}`;

    return this.prisma.task.create({
      data: {
        taskCode,
        content: data.content,
        source: data.source,
        assignedDate: new Date(data.assignedDate),
        assignedBy: data.assignedBy,
        documentNumber: data.documentNumber,
        ownerDepartmentId: data.ownerDepartmentId,
        requiredCompletionDate: data.requiredCompletionDate
          ? new Date(data.requiredCompletionDate)
          : null,
        createdBy: data.createdBy,
        coordinatingDepts: data.coordinatingDepartmentIds
          ? {
              create: data.coordinatingDepartmentIds.map((deptId) => ({
                departmentId: deptId,
              })),
            }
          : undefined,
      },
      include: {
        ownerDepartment: true,
        coordinatingDepts: { include: { department: true } },
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
      updatedBy: string;
      userRole: string;
    },
  ) {
    const oldTask = await this.prisma.task.findUnique({ where: { id } });
    if (!oldTask) throw new ForbiddenException('Task not found');

    await this.checkEditPermissions(oldTask, data, data.userRole);

    const { userRole, ...updateData } = data;

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
