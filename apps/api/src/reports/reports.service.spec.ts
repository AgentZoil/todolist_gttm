import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      task: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            taskCode: 'NV-001',
            title: 'Task 1',
            content: 'Content 1',
            documentNumber: '123/CV',
            priority: 'NORMAL',
            ownerDepartmentId: 'dept-1',
            ownerDepartment: { id: 'dept-1', name: 'Phòng QL', code: 'QL' },
            coordinatingUnits: 'Phòng KT',
            assignedDate: new Date('2026-01-01'),
            assignedBy: 'Admin',
            requiredCompletionDate: new Date('2026-01-10'),
            actualCompletionDate: new Date('2026-01-08'),
            isCancelled: false,
            approvedStatus: null,
            completionEvidence: 'Link test',
            incompleteReason: null,
            isFinalized: false,
            feedbacks: [{ content: 'Yêu cầu làm nhanh' }],
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return report data with summary', async () => {
    const result = await service.getReportData({ dateFilterType: 'ALL' });
    expect(result.summary.total).toBe(1);
    expect(result.summary.completedEarly).toBe(1);
    expect(result.summary.completionRate).toBe(100);
    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0].status).toBe('COMPLETED_EARLY');
    expect(result.tasks[0].directives).toEqual(['Yêu cầu làm nhanh']);
  });
});
