import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PeriodLockService } from '../period-lock/period-lock.service';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  calculateTaskStatus,
  getStatusLabel,
  getStatusColor,
  isPastDeadline,
  startOfDay,
} from './status';

const NHOM_A_FIELDS = [
  'content',
  'source',
  'assignedDate',
  'assignedBy',
  'documentNumber',
  'ownerDepartmentId',
  'requiredCompletionDate',
];

const NHOM_B_FIELDS = ['actualCompletionDate', 'completionEvidence', 'incompleteReason'];

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  NOT_SUBMITTED: 'Chưa gửi',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  NEEDS_REVISION: 'Cần bổ sung',
};

const COMPLETION_FIELDS = ['actualCompletionDate', 'completionEvidence'];
const REVISION_EDITABLE_FIELDS = new Set(COMPLETION_FIELDS);
const DEPARTMENT_EDITOR_EDITABLE_FIELDS = new Set(COMPLETION_FIELDS);

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly periodLockService: PeriodLockService,
    private readonly dashboardService: DashboardService,
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
      approvalStatusLabel: task.approvalStatus
        ? APPROVAL_STATUS_LABELS[task.approvalStatus]
        : undefined,
    };
  }

  async findAll(
    params: {
      departmentId?: string;
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      assignedBy?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ) {
    const {
      departmentId,
      page = 1,
      limit = 20,
      search,
      status,
      dateFrom,
      dateTo,
      assignedBy,
      sortBy = 'requiredCompletionDate',
      sortOrder = 'asc',
    } = params;

    const where: any = {};
    const andConditions: any[] = [];
    if (departmentId) where.ownerDepartmentId = departmentId;
    if (search) {
      andConditions.push({
        OR: [
          { content: { contains: search, mode: 'insensitive' } },
          { taskCode: { contains: search, mode: 'insensitive' } },
          { source: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (status) {
      if (status === 'IN_PROGRESS' || status === 'INCOMPLETE') {
        const today = startOfDay(new Date());
        where.isCancelled = false;
        where.actualCompletionDate = null;
        where.requiredCompletionDate = status === 'IN_PROGRESS'
          ? { not: null, gte: today }
          : { not: null, lt: today };
      } else if (status === 'COMPLETED_EARLY' || status === 'COMPLETED_ON_TIME' || status === 'COMPLETED_LATE') {
        where.isCancelled = false;
        where.actualCompletionDate = { not: null };
        where.requiredCompletionDate = { not: null };
      } else if (status === 'NO_EVALUATION') {
        where.isCancelled = false;
        where.requiredCompletionDate = null;
      } else if (status === 'CANCELLED') {
        where.isCancelled = true;
      }
    }
    if (dateFrom || dateTo) {
      const dateFilter: any = {};
      if (dateFrom) {
        const [year, month, day] = dateFrom.split('-').map(Number);
        dateFilter.gte = new Date(year, month - 1, day, 0, 0, 0, 0);
      }
      if (dateTo) {
        const [year, month, day] = dateTo.split('-').map(Number);
        dateFilter.lte = new Date(year, month - 1, day, 23, 59, 59, 999);
      }
      // Match dashboard month semantics: use deadline when present;
      // otherwise use assigned date for NO_EVALUATION tasks.
      andConditions.push({
        OR: [
          { requiredCompletionDate: dateFilter },
          { requiredCompletionDate: null, assignedDate: dateFilter },
        ],
      });
    }
    if (assignedBy) {
      where.assignedBy = assignedBy;
    }
    if (andConditions.length > 0) where.AND = andConditions;

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
          priority: true,
          documentNumber: true,
          coordinatingUnits: true,
          requiredCompletionDate: true,
          actualCompletionDate: true,
          isCancelled: true,
          isFinalized: true,
          approvalStatus: true,
          approvedStatus: true,
          approvedAt: true,
          approvedBy: true,
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

    let enrichedTasks = tasks.map((task) => this.enrichTask(task));

    if (status === 'COMPLETED_EARLY' || status === 'COMPLETED_ON_TIME' || status === 'COMPLETED_LATE') {
      enrichedTasks = enrichedTasks.filter((task) => {
        if (!task.actualCompletionDate || !task.requiredCompletionDate) return false;
        const actual = new Date(task.actualCompletionDate).getTime();
        const required = new Date(task.requiredCompletionDate).getTime();
        if (status === 'COMPLETED_EARLY') return actual < required;
        if (status === 'COMPLETED_ON_TIME') return actual === required;
        if (status === 'COMPLETED_LATE') return actual > required;
        return true;
      });
    }

    return {
      data: enrichedTasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPendingApprovals(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    const { page = 1, limit = 20, search } = params;
    const where: any = {
      approvalStatus: 'PENDING',
      isCancelled: false,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { taskCode: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
        { ownerDepartment: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: {
          id: true,
          taskCode: true,
          title: true,
          source: true,
          assignedBy: true,
          priority: true,
          requiredCompletionDate: true,
          actualCompletionDate: true,
          completionEvidence: true,
          approvalStatus: true,
          approvedStatus: true,
          approvedAt: true,
          approvedBy: true,
          isCancelled: true,
          isFinalized: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          ownerDepartment: {
            select: { id: true, code: true, name: true },
          },
          creator: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
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

  async findDepartmentAttention(departmentId: string, userId: string) {
    const where: any = {
      ownerDepartmentId: departmentId,
      isCancelled: false,
      isFinalized: false,
      OR: [
        { approvalStatus: 'NEEDS_REVISION' },
        {
          feedbacks: {
            some: {
              type: 'DIRECTIVE',
              readReceipts: { none: { userId } },
            },
          },
        },
      ],
    };

    const tasks = await this.prisma.task.findMany({
      where,
      select: {
        id: true,
        taskCode: true,
        title: true,
        requiredCompletionDate: true,
        actualCompletionDate: true,
        approvalStatus: true,
        updatedAt: true,
        ownerDepartment: {
          select: { id: true, code: true, name: true },
        },
        feedbacks: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            decision: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      data: tasks.map((task) => this.enrichTask(task)),
      pagination: {
        page: 1,
        limit: tasks.length,
        total: tasks.length,
        totalPages: tasks.length > 0 ? 1 : 0,
      },
    };
  }

  async markDepartmentAttentionRead(
    taskId: string,
    userId: string,
    departmentId: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { ownerDepartmentId: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.ownerDepartmentId !== departmentId) {
      throw new ForbiddenException('Bạn không có quyền cập nhật hộp công việc này');
    }

    const unreadDirectives = await this.prisma.taskFeedback.findMany({
      where: {
        taskId,
        type: 'DIRECTIVE',
        readReceipts: { none: { userId } },
      },
      select: { id: true },
    });

    if (unreadDirectives.length > 0) {
      await this.prisma.taskFeedbackRead.createMany({
        data: unreadDirectives.map((feedback) => ({
          feedbackId: feedback.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    return { success: true, marked: unreadDirectives.length };
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
        assignedDate: true,
        assignedBy: true,
        priority: true,
        documentNumber: true,
        requiredCompletionDate: true,
        actualCompletionDate: true,
        completionEvidence: true,
        incompleteReason: true,
        coordinatingUnits: true,
        ownerDepartmentId: true,
        isCancelled: true,
        cancelledAt: true,
        cancelledBy: true,
        isFinalized: true,
        approvalStatus: true,
        approvedStatus: true,
        approvedAt: true,
        approvedBy: true,
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
        feedbacks: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            decision: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, fullName: true } },
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
    priority?: 'URGENT' | 'NORMAL';
    documentNumber?: string;
    coordinatingUnits?: string;
    ownerDepartmentId: string;
    requiredCompletionDate?: string;
    createdBy: string;
  }) {
    const assignedDate = new Date(data.assignedDate);
    const requiredCompletionDate = data.requiredCompletionDate
      ? new Date(data.requiredCompletionDate)
      : null;

    if (requiredCompletionDate && requiredCompletionDate < assignedDate) {
      throw new ForbiddenException(
        'Ngày yêu cầu hoàn thành không được sớm hơn ngày giao nhiệm vụ',
      );
    }

    const taskCode = `NV-${Date.now()}`;

    const task = await this.prisma.task.create({
      data: {
        taskCode,
        title: data.title,
        content: data.content,
        source: data.source,
        assignedDate: new Date(data.assignedDate),
        assignedBy: data.assignedBy,
        priority: data.priority ?? 'NORMAL',
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

    await this.auditLogService.log({
      userId: data.createdBy,
      action: 'CREATE',
      entityType: 'TASK',
      entityId: task.id,
    });

    return task;
  }

  private async checkEditPermissions(
    task: any,
    data: Record<string, any>,
    userRole: string,
  ) {
    if (task.isFinalized && userRole !== 'ADMIN') {
      throw new ForbiddenException(
        'Nhiệm vụ đã được chốt, không thể chỉnh sửa',
      );
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
      title?: string;
      content?: string;
      source?: string;
      assignedDate?: string;
      assignedBy?: string;
      priority?: 'URGENT' | 'NORMAL';
      documentNumber?: string;
      ownerDepartmentId?: string;
      requiredCompletionDate?: string;
      actualCompletionDate?: string;
      completionEvidence?: string;
      incompleteReason?: string;
      coordinatingUnits?: string;
      expectedVersion?: number;
      updatedBy: string;
      userRole: string;
    },
  ) {
    const oldTask = await this.prisma.task.findUnique({ where: { id } });
    if (!oldTask) throw new NotFoundException('Task not found');

    const hasActualDateInput = Object.prototype.hasOwnProperty.call(
      data,
      'actualCompletionDate',
    );
    const nextActualCompletionDate = hasActualDateInput
      ? data.actualCompletionDate
        ? new Date(data.actualCompletionDate)
        : null
      : oldTask.actualCompletionDate;
    const completionFieldsChanged =
      (hasActualDateInput &&
        (oldTask.actualCompletionDate?.getTime() ?? null) !==
          (nextActualCompletionDate?.getTime() ?? null)) ||
      (Object.prototype.hasOwnProperty.call(data, 'completionEvidence') &&
        (data.completionEvidence || null) !== oldTask.completionEvidence);

    if (oldTask.approvalStatus === 'NEEDS_REVISION') {
      const changedFields = Object.keys(data).filter(
        (field) =>
          !['updatedBy', 'userRole', 'expectedVersion'].includes(field) &&
          !REVISION_EDITABLE_FIELDS.has(field),
      );
      if (changedFields.length > 0) {
        throw new ForbiddenException(
          'Nhiệm vụ cần bổ sung chỉ được sửa ngày hoàn thành thực tế và bằng chứng',
        );
      }
    }

    if (data.userRole === 'DEPARTMENT_EDITOR') {
      const changedFields = Object.keys(data).filter(
        (field) =>
          !['updatedBy', 'userRole', 'expectedVersion'].includes(field) &&
          !DEPARTMENT_EDITOR_EDITABLE_FIELDS.has(field),
      );
      if (changedFields.length > 0) {
        throw new ForbiddenException(
          'Đại diện phòng ban chỉ được cập nhật ngày hoàn thành thực tế và bằng chứng',
        );
      }
    }

    if (oldTask.approvalStatus === 'APPROVED' && completionFieldsChanged) {
      throw new ForbiddenException(
        'Nhiệm vụ đã được duyệt, cần yêu cầu bổ sung trước khi chỉnh sửa',
      );
    }

    if (
      data.expectedVersion !== undefined &&
      data.expectedVersion !== oldTask.version
    ) {
      throw new ConflictException(
        'Nhiệm vụ đã bị thay đổi bởi người khác. Vui lòng tải lại trang.',
      );
    }

    await this.checkEditPermissions(oldTask, data, data.userRole);

    const assignedDate = data.assignedDate
      ? new Date(data.assignedDate)
      : oldTask.assignedDate;
    const requiredCompletionDate = data.requiredCompletionDate
      ? new Date(data.requiredCompletionDate)
      : oldTask.requiredCompletionDate;
    const actualCompletionDate = nextActualCompletionDate;

    if (requiredCompletionDate && requiredCompletionDate < assignedDate) {
      throw new ForbiddenException(
        'Ngày yêu cầu hoàn thành không được sớm hơn ngày giao nhiệm vụ',
      );
    }

    if (actualCompletionDate && actualCompletionDate < assignedDate) {
      throw new ForbiddenException(
        'Ngày hoàn thành thực tế không được sớm hơn ngày giao nhiệm vụ',
      );
    }

    const isNewActualCompletionDate =
      data.actualCompletionDate !== undefined &&
      data.actualCompletionDate !== null &&
      data.actualCompletionDate !== '' &&
      (!oldTask.actualCompletionDate ||
        new Date(data.actualCompletionDate).getTime() !==
          oldTask.actualCompletionDate.getTime());
    if (
      isNewActualCompletionDate &&
      oldTask.actualCompletionDate === null &&
      requiredCompletionDate &&
      actualCompletionDate &&
      isPastDeadline(requiredCompletionDate) &&
      actualCompletionDate < startOfDay(new Date())
    ) {
      throw new ForbiddenException(
        'Nhiệm vụ đã quá hạn, ngày hoàn thành thực tế không được sớm hơn ngày hiện tại',
      );
    }

    const { userRole, expectedVersion, ...updateData } = data;

    const prismaData: Record<string, any> = {
      version: { increment: 1 },
    };

    if (completionFieldsChanged) {
      if (!oldTask.approvedStatus) {
        prismaData.approvedStatus = calculateTaskStatus({
          isCancelled: oldTask.isCancelled,
          requiredCompletionDate: oldTask.requiredCompletionDate,
          actualCompletionDate: oldTask.actualCompletionDate,
        });
      }
      prismaData.approvalStatus = actualCompletionDate
        ? 'PENDING'
        : 'NOT_SUBMITTED';
      prismaData.approvedAt = null;
      prismaData.approvedBy = null;
    }

    if (updateData.title !== undefined) prismaData.title = updateData.title;
    if (updateData.content !== undefined) prismaData.content = updateData.content;
    if (updateData.source !== undefined) prismaData.source = updateData.source;
    if (updateData.assignedBy !== undefined) prismaData.assignedBy = updateData.assignedBy;
    if (updateData.priority !== undefined) prismaData.priority = updateData.priority;
    if (updateData.documentNumber !== undefined) prismaData.documentNumber = updateData.documentNumber;
    if (updateData.ownerDepartmentId !== undefined) prismaData.ownerDepartmentId = updateData.ownerDepartmentId;
    if (updateData.coordinatingUnits !== undefined) prismaData.coordinatingUnits = updateData.coordinatingUnits;
    if (updateData.completionEvidence !== undefined) prismaData.completionEvidence = updateData.completionEvidence;
    if (updateData.incompleteReason !== undefined) prismaData.incompleteReason = updateData.incompleteReason;
    if (updateData.updatedBy !== undefined) prismaData.updatedBy = updateData.updatedBy;

    if (updateData.assignedDate) {
      prismaData.assignedDate = new Date(updateData.assignedDate);
    }

    if (updateData.requiredCompletionDate === null) {
      prismaData.requiredCompletionDate = null;
    } else if (updateData.requiredCompletionDate) {
      prismaData.requiredCompletionDate = new Date(updateData.requiredCompletionDate);
    }

    if (updateData.actualCompletionDate === null) {
      prismaData.actualCompletionDate = null;
    } else if (updateData.actualCompletionDate) {
      prismaData.actualCompletionDate = new Date(updateData.actualCompletionDate);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: prismaData,
      include: {
        ownerDepartment: true,
        coordinatingDepts: { include: { department: true } },
        updater: { select: { id: true, fullName: true } },
      },
    });

    const fieldsToTrack = [
      'content',
      'source',
      'assignedDate',
      'assignedBy',
      'priority',
      'documentNumber',
      'ownerDepartmentId',
      'requiredCompletionDate',
      'actualCompletionDate',
      'completionEvidence',
      'incompleteReason',
    ];

    for (const field of fieldsToTrack) {
      const oldValue = oldTask?.[field as keyof typeof oldTask];
      const newValue = updatedTask[field as keyof typeof updatedTask];
      const oldStr =
        oldValue instanceof Date
          ? oldValue.toISOString()
          : String(oldValue ?? '');
      const newStr =
        newValue instanceof Date
          ? newValue.toISOString()
          : String(newValue ?? '');

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

    this.dashboardService.invalidate();

    return updatedTask;
  }

  async approve(id: string, approvedBy: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.isCancelled) {
      throw new ForbiddenException('Nhiệm vụ đã hủy, không thể duyệt');
    }
    if (task.approvalStatus === 'APPROVED') {
      throw new ForbiddenException('Nhiệm vụ đã được duyệt');
    }
    if (task.approvalStatus !== 'PENDING') {
      throw new ForbiddenException(
        'Nhiệm vụ chưa có hồ sơ hoàn thành mới để duyệt',
      );
    }
    if (!task.actualCompletionDate) {
      throw new ForbiddenException(
        'Chỉ được duyệt nhiệm vụ sau khi có ngày hoàn thành thực tế',
      );
    }

    const status = calculateTaskStatus({
      isCancelled: task.isCancelled,
      requiredCompletionDate: task.requiredCompletionDate,
      actualCompletionDate: task.actualCompletionDate,
    });
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: {
          approvalStatus: 'APPROVED',
          approvedStatus: status,
          approvedAt: now,
          approvedBy,
          version: { increment: 1 },
        },
      });
      await tx.taskFeedback.create({
        data: {
          taskId: id,
          authorId: approvedBy,
          type: 'REVIEW',
          decision: 'APPROVED',
          content: 'Đã duyệt hoàn thành nhiệm vụ',
        },
      });
    });

    await this.auditLogService.log({
      userId: approvedBy,
      action: 'APPROVE_COMPLETION',
      entityType: 'TASK',
      entityId: id,
    });

    this.dashboardService.invalidate();
    return this.findOne(id);
  }

  async requestRevision(id: string, requestedBy: string, content: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.isCancelled) {
      throw new ForbiddenException('Nhiệm vụ đã hủy, không thể yêu cầu bổ sung');
    }
    if (task.approvalStatus === 'APPROVED') {
      throw new ForbiddenException('Nhiệm vụ đã được duyệt');
    }
    if (task.approvalStatus !== 'PENDING') {
      throw new ForbiddenException(
        'Nhiệm vụ chưa có hồ sơ hoàn thành mới để phản hồi',
      );
    }
    if (!task.actualCompletionDate) {
      throw new ForbiddenException(
        'Chỉ được yêu cầu bổ sung sau khi phòng ban đã nhập ngày hoàn thành thực tế',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: {
          approvalStatus: 'NEEDS_REVISION',
          version: { increment: 1 },
        },
      });
      await tx.taskFeedback.create({
        data: {
          taskId: id,
          authorId: requestedBy,
          type: 'REVIEW',
          decision: 'NEEDS_REVISION',
          content,
        },
      });
    });

    await this.auditLogService.log({
      userId: requestedBy,
      action: 'REQUEST_COMPLETION_REVISION',
      entityType: 'TASK',
      entityId: id,
    });

    this.dashboardService.invalidate();
    return this.findOne(id);
  }

  async addDirective(id: string, authorId: string, content: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    const feedback = await this.prisma.taskFeedback.create({
      data: {
        taskId: id,
        authorId,
        type: 'DIRECTIVE',
        content,
      },
      select: {
        id: true,
        type: true,
        decision: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, fullName: true } },
      },
    });
    await this.auditLogService.log({
      userId: authorId,
      action: 'ADD_TASK_DIRECTIVE',
      entityType: 'TASK',
      entityId: id,
    });
    return feedback;
  }

  async removeDirective(taskId: string, feedbackId: string, deletedBy: string) {
    const feedback = await this.prisma.taskFeedback.findUnique({
      where: { id: feedbackId },
      select: {
        id: true,
        taskId: true,
        authorId: true,
        type: true,
        task: { select: { isFinalized: true } },
      },
    });

    if (!feedback || feedback.taskId !== taskId) {
      throw new NotFoundException('Không tìm thấy ý kiến chỉ đạo');
    }
    if (feedback.type !== 'DIRECTIVE') {
      throw new ForbiddenException('Chỉ được xóa ý kiến chỉ đạo');
    }
    if (feedback.authorId !== deletedBy) {
      throw new ForbiddenException('Bạn chỉ được xóa ý kiến do mình tạo');
    }
    if (feedback.task.isFinalized) {
      throw new ForbiddenException('Nhiệm vụ đã được chốt, không thể xóa ý kiến');
    }

    await this.prisma.taskFeedback.delete({ where: { id: feedbackId } });
    await this.auditLogService.log({
      userId: deletedBy,
      action: 'DELETE_TASK_DIRECTIVE',
      entityType: 'TASK',
      entityId: taskId,
    });

    return { success: true };
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
    if (!task) throw new NotFoundException('Task not found');

    if (task.isFinalized) {
      throw new ForbiddenException('Nhiệm vụ đã được chốt');
    }

    if (userRole === 'DEPARTMENT_EDITOR') {
      if (
        task.ownerDepartmentId !== (await this.getDepartmentId(finalizedBy))
      ) {
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
    if (!task) throw new NotFoundException('Task not found');

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

  async remove(id: string, deletedBy: string, userRole: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (userRole === 'DEPARTMENT_EDITOR') {
      const deptId = await this.getDepartmentId(deletedBy);
      if (task.ownerDepartmentId !== deptId) {
        throw new ForbiddenException('Bạn không có quyền xóa nhiệm vụ này');
      }
    }

    if (task.isFinalized && userRole !== 'ADMIN') {
      throw new ForbiddenException('Nhiệm vụ đã được chốt, không thể xóa');
    }

    await this.prisma.taskCoordinatingDepartment.deleteMany({ where: { taskId: id } });
    await this.prisma.task.delete({ where: { id } });

    await this.auditLogService.log({
      userId: deletedBy,
      action: 'DELETE',
      entityType: 'TASK',
      entityId: id,
    });

    return { success: true };
  }
}
