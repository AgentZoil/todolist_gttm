import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { calculateTaskStatus, getStatusLabel, getStatusColor } from './status';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
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

  async canEditTask(taskId: string, currentUser: { role: string; departmentId: string }): Promise<boolean> {
    if (['ADMIN', 'SECRETARY'].includes(currentUser.role)) return true;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { ownerDepartmentId: true },
    });

    if (!task) return false;
    return task.ownerDepartmentId === currentUser.departmentId;
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
    },
  ) {
    const oldTask = await this.prisma.task.findUnique({ where: { id } });

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        ...data,
        assignedDate: data.assignedDate ? new Date(data.assignedDate) : undefined,
        requiredCompletionDate: data.requiredCompletionDate
          ? new Date(data.requiredCompletionDate)
          : undefined,
        actualCompletionDate: data.actualCompletionDate
          ? new Date(data.actualCompletionDate)
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
}
