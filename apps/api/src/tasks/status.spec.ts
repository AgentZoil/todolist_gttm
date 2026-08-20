import { calculateTaskStatus, TaskStatusInput } from './status';

describe('calculateTaskStatus', () => {
  it('should return CANCELLED when isCancelled is true', () => {
    const task: TaskStatusInput = {
      isCancelled: true,
      requiredCompletionDate: new Date('2026-08-20'),
      actualCompletionDate: new Date('2026-08-18'),
    };
    expect(calculateTaskStatus(task)).toBe('CANCELLED');
  });

  it('should return NO_EVALUATION when requiredCompletionDate is null', () => {
    const task: TaskStatusInput = {
      isCancelled: false,
      requiredCompletionDate: null,
      actualCompletionDate: null,
    };
    expect(calculateTaskStatus(task)).toBe('NO_EVALUATION');
  });

  it('should return NO_EVALUATION when requiredCompletionDate is null but actual exists', () => {
    const task: TaskStatusInput = {
      isCancelled: false,
      requiredCompletionDate: null,
      actualCompletionDate: new Date('2026-08-18'),
    };
    expect(calculateTaskStatus(task)).toBe('NO_EVALUATION');
  });

  it('should return IN_PROGRESS when actualCompletionDate is null', () => {
    const task: TaskStatusInput = {
      isCancelled: false,
      requiredCompletionDate: new Date('2026-08-20'),
      actualCompletionDate: null,
    };
    expect(calculateTaskStatus(task)).toBe('IN_PROGRESS');
  });

  it('should return COMPLETED_EARLY when actual < required', () => {
    const task: TaskStatusInput = {
      isCancelled: false,
      requiredCompletionDate: new Date('2026-08-20'),
      actualCompletionDate: new Date('2026-08-18'),
    };
    expect(calculateTaskStatus(task)).toBe('COMPLETED_EARLY');
  });

  it('should return COMPLETED_ON_TIME when actual = required', () => {
    const task: TaskStatusInput = {
      isCancelled: false,
      requiredCompletionDate: new Date('2026-08-20'),
      actualCompletionDate: new Date('2026-08-20'),
    };
    expect(calculateTaskStatus(task)).toBe('COMPLETED_ON_TIME');
  });

  it('should return COMPLETED_LATE when actual > required', () => {
    const task: TaskStatusInput = {
      isCancelled: false,
      requiredCompletionDate: new Date('2026-08-20'),
      actualCompletionDate: new Date('2026-08-22'),
    };
    expect(calculateTaskStatus(task)).toBe('COMPLETED_LATE');
  });

  it('should prioritize CANCELLED over other statuses', () => {
    const task: TaskStatusInput = {
      isCancelled: true,
      requiredCompletionDate: new Date('2026-08-20'),
      actualCompletionDate: new Date('2026-08-18'),
    };
    expect(calculateTaskStatus(task)).toBe('CANCELLED');
  });
});
