import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateTaskStatus } from '../tasks/status';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(month?: string) {
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
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
      include: {
        ownerDepartment: true,
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
      ['COMPLETED', 'COMPLETED_EARLY', 'COMPLETED_ON_TIME', 'COMPLETED_LATE'].includes(t.status),
    ).length;
    const inProgress = enrichedTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const overdue = enrichedTasks.filter((t) => t.status === 'COMPLETED_LATE').length;
    const noEvaluation = enrichedTasks.filter((t) => t.status === 'NO_EVALUATION').length;

    return {
      month: targetMonth,
      total,
      completed,
      inProgress,
      overdue,
      noEvaluation,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  async getDepartments(month?: string) {
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = targetMonth.split('-').map(Number);

    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
    });

    const results: Array<{
      departmentId: string;
      departmentCode: string;
      departmentName: string;
      total: number;
      completed: number;
      inProgress: number;
      overdue: number;
      completionRate: number;
    }> = [];

    for (const dept of departments) {
      const tasks = await this.prisma.task.findMany({
        where: {
          isCancelled: false,
          ownerDepartmentId: dept.id,
          requiredCompletionDate: {
            gte: startDate,
            lte: endDate,
          },
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
        ['COMPLETED', 'COMPLETED_EARLY', 'COMPLETED_ON_TIME', 'COMPLETED_LATE'].includes(t.status),
      ).length;
      const inProgress = enrichedTasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const overdue = enrichedTasks.filter((t) => t.status === 'COMPLETED_LATE').length;

      results.push({
        departmentId: dept.id,
        departmentCode: dept.code,
        departmentName: dept.name,
        total,
        completed,
        inProgress,
        overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      });
    }

    return { month: targetMonth, departments: results };
  }
}
