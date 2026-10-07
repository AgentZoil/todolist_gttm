import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodLockService } from '../period-lock/period-lock.service';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  calculateTaskStatus,
  getStatusLabel,
  getStatusColor,
  isPastDeadline,
  startOfOrganizationDay,
  compareDateOnly,
  organizationDateParts,
  organizationDateStart,
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

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  NOT_SUBMITTED: 'Chưa gửi',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  NEEDS_REVISION: 'Cần bổ sung',
};

const COMPLETION_FIELDS = ['actualCompletionDate', 'completionEvidence'];
const REVISION_EDITABLE_FIELDS = new Set(COMPLETION_FIELDS);
const DEPARTMENT_EDITOR_EDITABLE_FIELDS = new Set(COMPLETION_FIELDS);
const MAX_COMPLETION_STATUS_SCAN = 10_000;
const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE = 1_000;

type TaskAccessUser = {
  role: string;
  departmentId: string | null;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodLockService: PeriodLockService,
    private readonly dashboardService: DashboardService,
  ) {}

  private auditValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value) ?? String(value);
    return String(value);
  }

  private async auditDiff(
    tx: Prisma.TransactionClient,
    userId: string,
    entityId: string,
    action: string,
    before: object,
    after: object,
    fields: string[],
  ) {
    const changes = fields.flatMap((fieldName) => {
      const oldValue = this.auditValue((before as Record<string, unknown>)[fieldName]);
      const newValue = this.auditValue((after as Record<string, unknown>)[fieldName]);
      return oldValue === newValue ? [] : [{
        userId,
        action,
        entityType: 'TASK',
        entityId,
        fieldName,
        oldValue,
        newValue,
      }];
    });
    if (changes.length) await tx.auditLog.createMany({ data: changes });
  }

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

    const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, MAX_PAGE) : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 100)
      : 20;
    const allowedSortFields = [
      'requiredCompletionDate',
      'assignedDate',
      'actualCompletionDate',
      'createdAt',
      'updatedAt',
      'title',
      'priority',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'requiredCompletionDate';
    const safeSortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    if (search && search.length > MAX_SEARCH_LENGTH) {
      throw new BadRequestException('Từ khóa tìm kiếm quá dài');
    }
    const completionStatuses = [
      'COMPLETED_EARLY',
      'COMPLETED_ON_TIME',
      'COMPLETED_LATE',
    ];
    const needsCompletionStatusFilter = completionStatuses.includes(status || '');
    const allowedStatuses = [
      'IN_PROGRESS',
      'INCOMPLETE',
      'COMPLETED_EARLY',
      'COMPLETED_ON_TIME',
      'COMPLETED_LATE',
      'NO_EVALUATION',
      'CANCELLED',
    ];
    if (status && !allowedStatuses.includes(status)) {
      throw new BadRequestException('Trạng thái lọc không hợp lệ');
    }

    const where: any = {};
    const andConditions: any[] = [];
    if (departmentId) where.ownerDepartmentId = departmentId;
    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { taskCode: { contains: search, mode: 'insensitive' } },
          { source: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (status) {
      if (status === 'IN_PROGRESS' || status === 'INCOMPLETE') {
        const today = startOfOrganizationDay(new Date());
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
        dateFilter.gte = this.parseFilterDate(dateFrom, false);
      }
      if (dateTo) {
        dateFilter.lte = this.parseFilterDate(dateTo, true);
      }
      if (dateFilter.gte && dateFilter.lte && dateFilter.gte > dateFilter.lte) {
        throw new BadRequestException('Khoảng ngày lọc không hợp lệ');
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

    const taskSelect = {
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
    } as const;

    let tasks: any[];
    let total: number;
    if (needsCompletionStatusFilter) {
      const allMatchingTasks = await this.prisma.task.findMany({
        where,
        select: taskSelect,
        orderBy: { [safeSortBy]: safeSortOrder },
        take: MAX_COMPLETION_STATUS_SCAN + 1,
      });
      if (allMatchingTasks.length > MAX_COMPLETION_STATUS_SCAN) {
        throw new BadRequestException(
          'Có quá nhiều nhiệm vụ phù hợp. Vui lòng lọc thêm phòng ban hoặc khoảng ngày.',
        );
      }
      const filteredTasks = allMatchingTasks.filter((task) => {
        if (!task.actualCompletionDate || !task.requiredCompletionDate) return false;
        const comparison = compareDateOnly(
          new Date(task.actualCompletionDate),
          new Date(task.requiredCompletionDate),
        );
        if (status === 'COMPLETED_EARLY') return comparison < 0;
        if (status === 'COMPLETED_ON_TIME') return comparison === 0;
        return comparison > 0;
      });
      total = filteredTasks.length;
      tasks = filteredTasks.slice((safePage - 1) * safeLimit, safePage * safeLimit);
    } else {
      const result = await Promise.all([
        this.prisma.task.findMany({
          where,
          select: taskSelect,
          orderBy: { [safeSortBy]: safeSortOrder },
          skip: (safePage - 1) * safeLimit,
          take: safeLimit,
        }),
        this.prisma.task.count({ where }),
      ]);
      tasks = result[0];
      total = result[1];
    }

    let enrichedTasks = tasks.map((task) => this.enrichTask(task));

    return {
      data: enrichedTasks,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  private parseFilterDate(value: string, endOfDay: boolean): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new BadRequestException('Ngày lọc không hợp lệ');
    }
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() + 1 !== month ||
      calendarDate.getUTCDate() !== day
    ) {
      throw new BadRequestException('Ngày lọc không hợp lệ');
    }
    const start = organizationDateStart(year, month, day);
    return endOfDay ? new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) : start;
  }

  async findPendingApprovals(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    const { page = 1, limit = 20, search } = params;
    const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, MAX_PAGE) : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 100)
      : 20;
    const where: any = {
      approvalStatus: 'PENDING',
      isCancelled: false,
    };

    if (search && search.length > MAX_SEARCH_LENGTH) {
      throw new BadRequestException('Từ khóa tìm kiếm quá dài');
    }

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
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks.map((task) => this.enrichTask(task)),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findDepartmentAttention(
    departmentId: string,
    userId: string,
    page = 1,
    limit = 50,
  ) {
    const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, MAX_PAGE) : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 100)
      : 50;
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

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
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
            where: {
              OR: [
                {
                  type: 'DIRECTIVE',
                  readReceipts: { none: { userId } },
                },
                { type: 'REVIEW', decision: 'NEEDS_REVISION' },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
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
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks.map((task) => this.enrichTask(task)),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
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
      take: 1_000,
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

  async findOne(id: string, currentUser?: TaskAccessUser) {
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
        feedbacks: {
          orderBy: { createdAt: 'desc' },
          take: 100,
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
    if (task) task.feedbacks.reverse();
    if (
      task &&
      currentUser &&
      (currentUser.role === 'VIEWER' ||
        (currentUser.role === 'DEPARTMENT_EDITOR' &&
          currentUser.departmentId !== task.ownerDepartmentId))
    ) {
      return this.enrichTask({ ...task, feedbacks: [] });
    }

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

    if (requiredCompletionDate && compareDateOnly(requiredCompletionDate, assignedDate) < 0) {
      throw new ForbiddenException(
        'Ngày yêu cầu hoàn thành không được sớm hơn ngày giao nhiệm vụ',
      );
    }

    const taskCode = `NV-${Date.now()}`;

    const task = await this.prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
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

      await tx.auditLog.create({
        data: {
          userId: data.createdBy,
          action: 'CREATE',
          entityType: 'TASK',
          entityId: createdTask.id,
          fieldName: 'snapshot',
          newValue: JSON.stringify(createdTask),
        },
      });

      return createdTask;
    });

    this.dashboardService.invalidate();

    return task;
  }

  private async checkEditPermissions(
    task: any,
    data: Record<string, any>,
    userRole: string,
    requiredCompletionDate = task.requiredCompletionDate,
  ) {
    if (task.isFinalized && userRole !== 'ADMIN') {
      throw new ForbiddenException(
        'Nhiệm vụ đã được chốt, không thể chỉnh sửa',
      );
    }

    const nhomAKeys = Object.keys(data).filter((k) =>
      NHOM_A_FIELDS.includes(k),
    );
    if (nhomAKeys.length > 0 && requiredCompletionDate) {
      const d = new Date(requiredCompletionDate);
      const { year, month } = organizationDateParts(d);
      const isLocked = await this.periodLockService.isPeriodLocked(year, month);
      const { year: currentYear, month: currentMonth } = organizationDateParts(new Date());
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
      userDepartmentId?: string | null;
    },
  ) {
    const oldTask = await this.prisma.task.findUnique({ where: { id } });
    if (!oldTask) throw new NotFoundException('Task not found');

    if (!['ADMIN', 'SECRETARY', 'DEPARTMENT_EDITOR'].includes(data.userRole)) {
      throw new ForbiddenException('Bạn không có quyền sửa nhiệm vụ');
    }

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
          !['updatedBy', 'userRole', 'userDepartmentId', 'expectedVersion'].includes(field) &&
          !REVISION_EDITABLE_FIELDS.has(field),
      );
      if (changedFields.length > 0) {
        throw new ForbiddenException(
          'Nhiệm vụ cần bổ sung chỉ được sửa ngày hoàn thành thực tế và bằng chứng',
        );
      }
    }

    if (data.userRole === 'DEPARTMENT_EDITOR') {
      if (!data.userDepartmentId || oldTask.ownerDepartmentId !== data.userDepartmentId) {
        throw new ForbiddenException('Bạn không có quyền sửa nhiệm vụ của phòng ban khác');
      }
      const changedFields = Object.keys(data).filter(
        (field) =>
          !['updatedBy', 'userRole', 'userDepartmentId', 'expectedVersion'].includes(field) &&
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

    const assignedDate = data.assignedDate
      ? new Date(data.assignedDate)
      : oldTask.assignedDate;
    const requiredCompletionDate = data.requiredCompletionDate
      ? new Date(data.requiredCompletionDate)
      : oldTask.requiredCompletionDate;
    const actualCompletionDate = nextActualCompletionDate;

    await this.checkEditPermissions(
      oldTask,
      data,
      data.userRole,
      requiredCompletionDate ?? oldTask.requiredCompletionDate,
    );

    if (requiredCompletionDate && compareDateOnly(requiredCompletionDate, assignedDate) < 0) {
      throw new ForbiddenException(
        'Ngày yêu cầu hoàn thành không được sớm hơn ngày giao nhiệm vụ',
      );
    }

    if (actualCompletionDate && compareDateOnly(actualCompletionDate, assignedDate) < 0) {
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
      compareDateOnly(actualCompletionDate, startOfOrganizationDay(new Date())) < 0
    ) {
      throw new ForbiddenException(
        'Nhiệm vụ đã quá hạn, ngày hoàn thành thực tế không được sớm hơn ngày hiện tại',
      );
    }

    const updateData: Record<string, any> = { ...data };
    delete updateData.userRole;
    delete updateData.userDepartmentId;
    delete updateData.expectedVersion;

    const prismaData: Record<string, any> = {
      version: { increment: 1 },
    };

    if (completionFieldsChanged) {
      if (!oldTask.approvedStatus) {
        prismaData.approvedStatus = calculateTaskStatus({
          isCancelled: oldTask.isCancelled,
          requiredCompletionDate: oldTask.requiredCompletionDate,
          actualCompletionDate,
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

    const fieldsToTrack = [
      'title',
      'content',
      'source',
      'assignedDate',
      'assignedBy',
      'priority',
      'documentNumber',
      'coordinatingUnits',
      'ownerDepartmentId',
      'requiredCompletionDate',
      'actualCompletionDate',
      'completionEvidence',
      'incompleteReason',
      'approvalStatus',
      'approvedStatus',
      'approvedAt',
      'approvedBy',
      'updatedBy',
      'version',
    ];
    const updatedTask = await this.prisma.$transaction(async (tx) => {
      const current = await tx.task.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Task not found');
      if (current.version !== oldTask.version) {
        throw new ConflictException(
          'Nhiệm vụ đã bị thay đổi bởi người khác. Vui lòng tải lại trang.',
        );
      }

      const claim = await tx.task.updateMany({
        where: { id, version: current.version },
        data: prismaData,
      });
      if (claim.count !== 1) {
        throw new ConflictException(
          'Nhiệm vụ đã bị thay đổi bởi người khác. Vui lòng tải lại trang.',
        );
      }
      const updated = await tx.task.findUniqueOrThrow({
        where: { id },
        include: {
          ownerDepartment: true,
          updater: { select: { id: true, fullName: true } },
        },
      });
      await this.auditDiff(tx, data.updatedBy, id, 'UPDATE', current, updated, fieldsToTrack);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
      const claim = await tx.task.updateMany({
        where: { id, version: task.version, approvalStatus: 'PENDING' },
        data: {
          approvalStatus: 'APPROVED',
          approvedStatus: status,
          approvedAt: now,
          approvedBy,
          version: { increment: 1 },
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException('Nhiệm vụ đã bị thay đổi. Vui lòng tải lại trang.');
      }
      const feedback = await tx.taskFeedback.create({
        data: {
          taskId: id,
          authorId: approvedBy,
          type: 'REVIEW',
          decision: 'APPROVED',
          content: 'Đã duyệt hoàn thành nhiệm vụ',
        },
      });
      await tx.auditLog.create({
        data: {
          userId: approvedBy,
          action: 'APPROVE_COMPLETION',
          entityType: 'TASK',
          entityId: id,
          fieldName: 'feedback',
          newValue: JSON.stringify({ id: feedback.id, decision: feedback.decision, content: feedback.content }),
        },
      });
      await this.auditDiff(
        tx,
        approvedBy,
        id,
        'APPROVE_COMPLETION',
        task,
        { ...task, approvalStatus: 'APPROVED', approvedStatus: status, approvedAt: now, approvedBy },
        ['approvalStatus', 'approvedStatus', 'approvedAt', 'approvedBy'],
      );
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
      const claim = await tx.task.updateMany({
        where: { id, version: task.version, approvalStatus: 'PENDING' },
        data: {
          approvalStatus: 'NEEDS_REVISION',
          version: { increment: 1 },
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException('Nhiệm vụ đã bị thay đổi. Vui lòng tải lại trang.');
      }
      const feedback = await tx.taskFeedback.create({
        data: {
          taskId: id,
          authorId: requestedBy,
          type: 'REVIEW',
          decision: 'NEEDS_REVISION',
          content,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: requestedBy,
          action: 'REQUEST_COMPLETION_REVISION',
          entityType: 'TASK',
          entityId: id,
          fieldName: 'feedback',
          newValue: JSON.stringify({ id: feedback.id, decision: feedback.decision, content: feedback.content }),
        },
      });
      await this.auditDiff(
        tx,
        requestedBy,
        id,
        'REQUEST_COMPLETION_REVISION',
        task,
        { ...task, approvalStatus: 'NEEDS_REVISION' },
        ['approvalStatus'],
      );
    });

    this.dashboardService.invalidate();
    return this.findOne(id);
  }

  async addDirective(id: string, authorId: string, content: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.$transaction(async (tx) => {
      const feedback = await tx.taskFeedback.create({
        data: { taskId: id, authorId, type: 'DIRECTIVE', content },
        select: {
          id: true,
          type: true,
          decision: true,
          content: true,
          createdAt: true,
          author: { select: { id: true, fullName: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: authorId,
          action: 'ADD_TASK_DIRECTIVE',
          entityType: 'TASK',
          entityId: id,
          fieldName: 'directive',
          newValue: JSON.stringify(feedback),
        },
      });
      return feedback;
    });
  }

  async removeDirective(taskId: string, feedbackId: string, deletedBy: string) {
    await this.prisma.$transaction(async (tx) => {
      const feedback = await tx.taskFeedback.findUnique({
        where: { id: feedbackId },
        select: {
          id: true,
          taskId: true,
          authorId: true,
          type: true,
          content: true,
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
      await tx.taskFeedback.delete({ where: { id: feedbackId } });
      await tx.auditLog.create({
        data: {
          userId: deletedBy,
          action: 'DELETE_TASK_DIRECTIVE',
          entityType: 'TASK',
          entityId: taskId,
          fieldName: 'directive',
          oldValue: JSON.stringify({ id: feedback.id, authorId: feedback.authorId, type: feedback.type, content: feedback.content }),
          newValue: null,
        },
      });
    });

    return { success: true };
  }

  async cancel(id: string, cancelledBy: string, userRole: string) {
    const existingTask = await this.prisma.task.findUnique({ where: { id } });
    if (!existingTask) throw new NotFoundException('Task not found');
    if (existingTask.isCancelled) {
      throw new ConflictException('Nhiệm vụ đã được hủy');
    }
    if (existingTask.isFinalized && userRole !== 'ADMIN') {
      throw new ForbiddenException('Nhiệm vụ đã được chốt, không thể hủy');
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const current = await tx.task.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Task not found');
      if (current.isCancelled) {
        throw new ConflictException('Nhiệm vụ đã được hủy');
      }
      if (current.version !== existingTask.version) {
        throw new ConflictException('Nhiệm vụ đã bị thay đổi. Vui lòng tải lại trang.');
      }
      const now = new Date();
      const claim = await tx.task.updateMany({
        where: { id, version: current.version },
        data: { isCancelled: true, cancelledAt: now, cancelledBy, version: { increment: 1 } },
      });
      if (claim.count !== 1) throw new ConflictException('Nhiệm vụ đã bị thay đổi. Vui lòng tải lại trang.');
      const updated = await tx.task.findUniqueOrThrow({
        where: { id },
        include: { ownerDepartment: true },
      });
      await this.auditDiff(tx, cancelledBy, id, 'CANCEL', current, updated, ['isCancelled', 'cancelledAt', 'cancelledBy']);
      return updated;
    });

    this.dashboardService.invalidate();

    return task;
  }

  async finalize(id: string, finalizedBy: string, userRole: string) {
    if (!['ADMIN', 'SECRETARY', 'DEPARTMENT_EDITOR'].includes(userRole)) {
      throw new ForbiddenException('Bạn không có quyền chốt nhiệm vụ');
    }

    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (task.isFinalized) {
      throw new ForbiddenException('Nhiệm vụ đã được chốt');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.task.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Task not found');
      if (current.version !== task.version || current.isFinalized) {
        throw new ConflictException('Nhiệm vụ đã thay đổi hoặc đã được chốt');
      }
      if (userRole === 'DEPARTMENT_EDITOR') {
        const actor = await tx.user.findUnique({ where: { id: finalizedBy }, select: { departmentId: true } });
        if (current.ownerDepartmentId !== (actor?.departmentId ?? '')) {
          throw new ForbiddenException('Chỉ chủ nhiệm vụ mới được chốt');
        }
      }
      const now = new Date();
      const claim = await tx.task.updateMany({
        where: { id, version: current.version, isFinalized: false },
        data: { isFinalized: true, finalizedAt: now, finalizedBy, version: { increment: 1 } },
      });
      if (claim.count !== 1) throw new ConflictException('Nhiệm vụ đã thay đổi hoặc đã được chốt');
      const result = await tx.task.findUniqueOrThrow({
        where: { id },
        include: { ownerDepartment: true },
      });
      await this.auditDiff(tx, finalizedBy, id, 'FINALIZE', current, result, ['isFinalized', 'finalizedAt', 'finalizedBy']);
      return result;
    });

    return updated;
  }

  async unfinalize(id: string, unfinalizedBy: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (!task.isFinalized) {
      throw new ForbiddenException('Nhiệm vụ chưa được chốt');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.task.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Task not found');
      if (current.version !== task.version || !current.isFinalized) {
        throw new ConflictException('Nhiệm vụ đã thay đổi hoặc chưa được chốt');
      }
      const claim = await tx.task.updateMany({
        where: { id, version: current.version, isFinalized: true },
        data: { isFinalized: false, finalizedAt: null, finalizedBy: null, version: { increment: 1 } },
      });
      if (claim.count !== 1) throw new ConflictException('Nhiệm vụ đã thay đổi hoặc chưa được chốt');
      const result = await tx.task.findUniqueOrThrow({
        where: { id },
        include: { ownerDepartment: true },
      });
      await this.auditDiff(tx, unfinalizedBy, id, 'UNFINALIZE', current, result, ['isFinalized', 'finalizedAt', 'finalizedBy']);
      return result;
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
    if (!['ADMIN', 'SECRETARY', 'DEPARTMENT_EDITOR'].includes(userRole)) {
      throw new ForbiddenException('Bạn không có quyền xóa nhiệm vụ');
    }

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

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.task.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Task not found');
      if (current.version !== task.version) {
        throw new ConflictException('Nhiệm vụ đã bị thay đổi. Vui lòng tải lại trang.');
      }
      const feedbackWhere = { taskId: id };
      const [feedbacks, feedbackCount] = await Promise.all([
        tx.taskFeedback.findMany({
          where: feedbackWhere,
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        tx.taskFeedback.count({ where: feedbackWhere }),
      ]);
      const deleted = await tx.task.deleteMany({ where: { id, version: current.version } });
      if (deleted.count !== 1) {
        throw new ConflictException('Nhiệm vụ đã bị thay đổi. Vui lòng tải lại trang.');
      }
      await tx.auditLog.create({
        data: {
          userId: deletedBy,
          action: 'DELETE',
          entityType: 'TASK',
          entityId: id,
          fieldName: 'snapshot',
          oldValue: JSON.stringify({
            task: current,
            feedbacks,
            feedbackCount,
            feedbacksTruncated: feedbackCount > feedbacks.length,
          }),
          newValue: null,
        },
      });
    });

    this.dashboardService.invalidate();

    return { success: true };
  }
}
