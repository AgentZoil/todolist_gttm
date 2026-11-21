import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthGuard } from '../auth/auth.guard';
import { ReportsController } from './reports.controller';
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
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
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

describe('Reports HTTP endpoints', () => {
  let app: INestApplication<App>;
  const task = {
    title: 'Kiểm tra cầu',
    content: 'Kiểm tra hiện trạng',
    taskCode: 'NV-001',
    documentNumber: '123/CV',
    priority: 'NORMAL',
    ownerDepartmentId: 'dept-1',
    ownerDepartment: { name: 'Phòng Kỹ thuật' },
    coordinatingUnits: 'Đơn vị phối hợp',
    assignedDate: new Date('2026-10-01'),
    assignedBy: 'Lãnh đạo',
    requiredCompletionDate: new Date('2026-10-02T17:00:00.000Z'),
    actualCompletionDate: new Date('2026-10-02T17:00:00.000Z'),
    isCancelled: false,
    approvedStatus: 'COMPLETED_ON_TIME',
    completionEvidence: 'Biên bản',
    incompleteReason: null,
    isFinalized: false,
    feedbacks: [
      { content: 'Chỉ đạo thứ nhất' },
      { content: 'Chỉ đạo thứ hai' },
    ],
  };
  const matchingTasks = Array.from({ length: 21 }, (_, index) => ({
    ...task,
    id: `task-${index + 1}`,
    title: `Kiểm tra cầu ${index + 1}`,
  }));
  const findMany = jest.fn();
  const findDepartment = jest
    .fn()
    .mockResolvedValue({ name: 'Phòng Kỹ thuật' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: {
            task: { findMany },
            department: { findUnique: findDepartment },
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          req.currentUser = { role: req.headers['x-test-role'] ?? 'ADMIN' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    findMany
      .mockReset()
      .mockResolvedValue([
        ...matchingTasks,
        {
          ...task,
          id: 'no-evaluation',
          requiredCompletionDate: null,
          approvedStatus: null,
        },
        { ...task, id: 'cancelled', isCancelled: true },
        { ...task, id: 'late', approvedStatus: 'COMPLETED_LATE' },
      ]);
    findDepartment.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('preserves combined filters through validation and exports the same filtered rows and totals', async () => {
    const filters = {
      dateFilterType: 'CUSTOM',
      dateFrom: '2026-10-03',
      dateTo: '2026-10-03',
      departmentId: 'dept-1',
      statusGroup: 'COMPLETED_ON_TIME',
      search: '  Kiểm tra cầu  ',
    };
    const preview = await request(app.getHttpServer())
      .get('/reports/tasks')
      .query(filters)
      .expect(200);
    const range = {
      gte: new Date('2026-10-02T17:00:00.000Z'),
      lt: new Date('2026-10-03T17:00:00.000Z'),
    };
    const contains = { contains: 'Kiểm tra cầu', mode: 'insensitive' };
    expect(findMany.mock.calls[0][0].where).toEqual({
      ownerDepartmentId: 'dept-1',
      OR: [
        { requiredCompletionDate: range },
        { requiredCompletionDate: null, assignedDate: range },
      ],
      AND: {
        OR: [
          { title: contains },
          { content: contains },
          { documentNumber: contains },
          { ownerDepartment: { name: contains } },
          { assignedBy: contains },
        ],
      },
    });
    expect(preview.body.tasks.map((row) => row.id)).toEqual(
      matchingTasks.map((row) => row.id),
    );
    expect(preview.body.summary).toMatchObject({
      total: 21,
      completedOnTime: 21,
      completedLate: 0,
      noEvaluation: 0,
      cancelled: 0,
      completionRate: 100,
      onTimeRate: 100,
    });

    const exported = await request(app.getHttpServer())
      .get('/reports/tasks/export')
      .query(filters)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
        response.on('error', (error: Error) => callback(error, null));
      })
      .expect(200)
      .expect('Content-Type', /spreadsheetml/);
    expect(findMany.mock.calls[1][0].where).toEqual(
      findMany.mock.calls[0][0].where,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.body);
    const sheet = workbook.worksheets[0];
    const evidenceColumnWidth = sheet.getColumn('I').width;
    const otherColumnWidths = sheet.columns
      .filter((column) => column.number !== 9)
      .map((column) => column.width);
    expect(evidenceColumnWidth).toBeGreaterThan(Math.max(...otherColumnWidths));
    expect(sheet.getCell('I11').alignment.wrapText).toBe(true);
    expect(sheet.getCell('A5').value).toContain(
      'Phòng Kỹ thuật · Trạng thái: Hoàn thành đúng hạn',
    );
    expect(sheet.getCell('A6').value).toBe('Từ khóa: Kiểm tra cầu');
    expect(sheet.getCell('A8').value).toBe(21);
    expect(sheet.getCell('C8').value).toBe(21);
    expect(sheet.getCell('I8').value).toBe(1);
    expect(sheet.getCell('F11').value).toBe('03/10/2026');
    expect(sheet.getCell('J11').value).toBe(
      'Chỉ đạo thứ nhất\nChỉ đạo thứ hai',
    );
    expect(sheet.getRows(11, 21)?.map((row) => row.getCell(3).value)).toEqual(
      matchingTasks.map((row) => `${row.title}\n${row.content}`),
    );
    expect(sheet.getCell('A32').value).toBeNull();
  });

  it.each([
    [
      { dateFilterType: 'MONTH', month: '2026-10' },
      { gte: '2026-09-30T17:00:00.000Z', lt: '2026-10-31T17:00:00.000Z' },
    ],
    [
      { dateFilterType: 'YEAR', year: '2026' },
      { gte: '2025-12-31T17:00:00.000Z', lt: '2026-12-31T17:00:00.000Z' },
    ],
    [
      { dateFilterType: 'CUSTOM', dateTo: '2026-10-03' },
      { lt: '2026-10-03T17:00:00.000Z' },
    ],
  ])('uses Vietnam date boundaries for %j', async (filters, bounds) => {
    await request(app.getHttpServer())
      .get('/reports/tasks')
      .query(filters)
      .expect(200);
    expect(
      findMany.mock.calls[0][0].where.OR[0].requiredCompletionDate,
    ).toEqual(
      Object.fromEntries(
        Object.entries(bounds).map(([key, value]) => [key, new Date(value)]),
      ),
    );
  });

  it.each([
    { dateFilterType: 'MONTH', month: '2026-13' },
    { dateFilterType: 'CUSTOM' },
    { dateFilterType: 'CUSTOM', dateFrom: '2026-02-30' },
    { dateFilterType: 'CUSTOM', dateFrom: '2026-10-04', dateTo: '2026-10-03' },
    { statusGroup: 'UNKNOWN' },
  ])(
    'rejects invalid filters instead of broadening the report (%j)',
    async (filters) => {
      await request(app.getHttpServer())
        .get('/reports/tasks')
        .query(filters)
        .expect(400);
      await request(app.getHttpServer())
        .get('/reports/tasks/export')
        .query(filters)
        .expect(400);
      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it('keeps cancelled and unevaluated tasks out of the processing rate', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/tasks')
      .query({
        dateFilterType: 'ALL',
      })
      .expect(200);
    expect(response.body.summary).toMatchObject({
      total: 24,
      cancelled: 1,
      noEvaluation: 1,
      completionRate: 100,
      onTimeRate: 95,
    });
    const unevaluated = await request(app.getHttpServer())
      .get('/reports/tasks')
      .query({
        statusGroup: 'NO_EVALUATION',
      })
      .expect(200);
    expect(unevaluated.body.tasks.map((row) => row.id)).toEqual([
      'no-evaluation',
    ]);
    expect(unevaluated.body.summary).toMatchObject({
      total: 1,
      noEvaluation: 1,
      completionRate: 0,
      onTimeRate: 0,
    });
  });

  it('keeps both endpoints restricted to admins', async () => {
    await request(app.getHttpServer())
      .get('/reports/tasks')
      .set('x-test-role', 'VIEWER')
      .expect(403);
    await request(app.getHttpServer())
      .get('/reports/tasks/export')
      .set('x-test-role', 'VIEWER')
      .expect(403);
    expect(findMany).not.toHaveBeenCalled();
  });
});
