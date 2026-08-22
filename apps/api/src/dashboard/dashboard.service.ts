import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateTaskStatus } from '../tasks/status';

interface CacheEntry<T> {
  data: T;
  expires: number;
}

@Injectable()
export class DashboardService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(private readonly prisma: PrismaService) {}

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expires) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.CACHE_TTL,
    });
  }

  async getSummary(month?: string) {
    const targetMonth =
      month ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const cacheKey = `summary:${targetMonth}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const [year, monthNum] = targetMonth.split('-').map(Number);

    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const tasks = await this.prisma.task.findMany({
      where: {
        isCancelled: false,
        requiredCompletionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        isCancelled: true,
        requiredCompletionDate: true,
        actualCompletionDate: true,
      },
    });

    const enrichedTasks = tasks.map((task) => {
      const status = calculateTaskStatus({
        isCancelled: task.isCancelled,
        requiredCompletionDate: task.requiredCompletionDate,
        actualCompletionDate: task.actualCompletionDate,
      });
      return { ...task, status };
    });

    const total = enrichedTasks.length;
    const completed = enrichedTasks.filter((t) =>
      [
        'COMPLETED',
        'COMPLETED_EARLY',
        'COMPLETED_ON_TIME',
        'COMPLETED_LATE',
      ].includes(t.status),
    ).length;
    const inProgress = enrichedTasks.filter(
      (t) => t.status === 'IN_PROGRESS',
    ).length;
    const overdue = enrichedTasks.filter(
      (t) => t.status === 'COMPLETED_LATE',
    ).length;
    const noEvaluation = enrichedTasks.filter(
      (t) => t.status === 'NO_EVALUATION',
    ).length;

    const result = {
      month: targetMonth,
      total,
      completed,
      inProgress,
      overdue,
      noEvaluation,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };

    this.setCache(cacheKey, result);
    return result;
  }

  async getDepartments(month?: string) {
    const targetMonth =
      month ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const cacheKey = `departments:${targetMonth}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const [year, monthNum] = targetMonth.split('-').map(Number);

    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });

    const allTasks = await this.prisma.task.findMany({
      where: {
        isCancelled: false,
        OR: [
          { requiredCompletionDate: { gte: startDate, lte: endDate } },
          { requiredCompletionDate: { gt: endDate } },
          { requiredCompletionDate: null },
        ],
      },
      select: {
        ownerDepartmentId: true,
        isCancelled: true,
        requiredCompletionDate: true,
        actualCompletionDate: true,
      },
    });

    const deptTaskMap = new Map<string, typeof allTasks>();
    for (const task of allTasks) {
      const existing = deptTaskMap.get(task.ownerDepartmentId) || [];
      existing.push(task);
      deptTaskMap.set(task.ownerDepartmentId, existing);
    }

    const results = departments.map((dept) => {
      const deptTasks = deptTaskMap.get(dept.id) || [];
      const enrichedTasks = deptTasks.map((task) => {
        const status = calculateTaskStatus({
          isCancelled: task.isCancelled,
          requiredCompletionDate: task.requiredCompletionDate,
          actualCompletionDate: task.actualCompletionDate,
        });
        return { ...task, status };
      });

      const total = enrichedTasks.length;
      const completedOnTime = enrichedTasks.filter(
        (t) =>
          t.status === 'COMPLETED_EARLY' || t.status === 'COMPLETED_ON_TIME',
      ).length;
      const completedLate = enrichedTasks.filter(
        (t) => t.status === 'COMPLETED_LATE',
      ).length;
      const now = new Date();
      const inProgressOnTime = enrichedTasks.filter(
        (t) =>
          t.status === 'IN_PROGRESS' &&
          t.requiredCompletionDate &&
          t.requiredCompletionDate > now,
      ).length;
      const inProgressLate = enrichedTasks.filter(
        (t) =>
          t.status === 'IN_PROGRESS' &&
          t.requiredCompletionDate &&
          t.requiredCompletionDate <= now,
      ).length;
      const noEvaluation = enrichedTasks.filter(
        (t) => t.status === 'NO_EVALUATION',
      ).length;

      const ratedTotal = completedOnTime + completedLate + inProgressOnTime + inProgressLate;

      return {
        departmentId: dept.id,
        departmentCode: dept.code,
        departmentName: dept.name,
        total,
        completedOnTime,
        completedLate,
        inProgressOnTime,
        inProgressLate,
        noEvaluation,
        completionRate:
          ratedTotal > 0
            ? Math.round(
                ((completedOnTime + completedLate) / ratedTotal) * 100,
              )
            : 0,
      };
    });

    const result = { month: targetMonth, departments: results };
    this.setCache(cacheKey, result);
    return result;
  }
}
