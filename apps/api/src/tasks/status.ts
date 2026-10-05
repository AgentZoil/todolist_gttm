export type TaskStatus =
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'INCOMPLETE'
  | 'COMPLETED_EARLY'
  | 'COMPLETED_ON_TIME'
  | 'COMPLETED_LATE'
  | 'NO_EVALUATION';

export interface TaskStatusInput {
  isCancelled: boolean;
  requiredCompletionDate: Date | null;
  actualCompletionDate: Date | null;
  now?: Date;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ORGANIZATION_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const ORGANIZATION_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

function dateOrdinal(date: Date): number {
  const { year, month, day } = organizationDateParts(date);
  return Date.UTC(year, month - 1, day) / DAY_IN_MS;
}

export function organizationDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORGANIZATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

export function compareDateOnly(left: Date, right: Date): number {
  return dateOrdinal(left) - dateOrdinal(right);
}

export function organizationDateStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - ORGANIZATION_UTC_OFFSET_MS);
}

export function startOfOrganizationDay(date: Date): Date {
  const { year, month, day } = organizationDateParts(date);
  return organizationDateStart(year, month, day);
}

export function isPastDeadline(requiredCompletionDate: Date, now = new Date()): boolean {
  const today = organizationDateParts(now);
  const todayOrdinal = Date.UTC(today.year, today.month - 1, today.day) / DAY_IN_MS;
  return todayOrdinal > dateOrdinal(requiredCompletionDate);
}

export function calculateTaskStatus(task: TaskStatusInput): TaskStatus {
  if (task.isCancelled) {
    return 'CANCELLED';
  }

  if (task.requiredCompletionDate === null) {
    return 'NO_EVALUATION';
  }

  if (task.actualCompletionDate === null) {
    return isPastDeadline(task.requiredCompletionDate, task.now)
      ? 'INCOMPLETE'
      : 'IN_PROGRESS';
  }

  const required = dateOrdinal(task.requiredCompletionDate);
  const actual = dateOrdinal(task.actualCompletionDate);

  if (actual < required) {
    return 'COMPLETED_EARLY';
  }

  if (actual === required) {
    return 'COMPLETED_ON_TIME';
  }

  return 'COMPLETED_LATE';
}

export function getStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    CANCELLED: 'Đã hủy',
    IN_PROGRESS: 'Đang thực hiện',
    INCOMPLETE: 'Không hoàn thành',
    COMPLETED_EARLY: 'Hoàn thành trước hạn',
    COMPLETED_ON_TIME: 'Hoàn thành đúng hạn',
    COMPLETED_LATE: 'Hoàn thành quá hạn',
    NO_EVALUATION: 'Không đánh giá',
  };
  return labels[status];
}

export function getStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    CANCELLED: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    IN_PROGRESS:
      'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    INCOMPLETE:
      'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    COMPLETED_EARLY:
      'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    COMPLETED_ON_TIME:
      'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    COMPLETED_LATE:
      'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    NO_EVALUATION:
      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return colors[status];
}
