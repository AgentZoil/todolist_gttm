import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateTaskStatus,
  getStatusLabel,
  organizationDateParts,
  organizationDateStart,
  TaskStatus,
} from '../tasks/status';
import { ReportQueryDto } from './dto/report-query.dto';

export interface ReportTaskItem {
  id: string;
  taskCode: string;
  title: string;
  content: string;
  documentNumber: string | null;
  priority: string;
  ownerDepartmentId: string;
  ownerDepartmentName: string;
  coordinatingUnits: string | null;
  assignedDate: Date;
  assignedBy: string;
  requiredCompletionDate: Date | null;
  actualCompletionDate: Date | null;
  status: TaskStatus;
  statusLabel: string;
  completionEvidence: string | null;
  incompleteReason: string | null;
  isFinalized: boolean;
  directives: string[];
}

const COMPLETED_STATUSES: readonly TaskStatus[] = [
  'COMPLETED_EARLY',
  'COMPLETED_ON_TIME',
  'COMPLETED_LATE',
];

const reportDateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function parseReportDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = organizationDateStart(year, month, day);
  if (!Number.isFinite(date.getTime())) {
    throw new BadRequestException('Ngày lọc báo cáo không hợp lệ.');
  }
  const actual = organizationDateParts(date);
  if (actual.year !== year || actual.month !== month || actual.day !== day) {
    throw new BadRequestException('Ngày lọc báo cáo không hợp lệ.');
  }
  return { date, nextDay: organizationDateStart(year, month, day + 1) };
}

function buildPeriod(
  dto: ReportQueryDto,
  now: Date,
): {
  label: string;
  range?: { gte?: Date; lt?: Date };
} {
  const { dateFilterType = 'ALL', year, month, dateFrom, dateTo } = dto;

  if (dateFilterType === 'ALL') return { label: 'Toàn thời gian' };

  if (dateFilterType === 'YEAR') {
    const targetYear = year ? Number(year) : organizationDateParts(now).year;
    return {
      label: `Năm ${targetYear}`,
      range: {
        gte: organizationDateStart(targetYear, 1, 1),
        lt: organizationDateStart(targetYear + 1, 1, 1),
      },
    };
  }

  if (dateFilterType === 'MONTH') {
    const today = organizationDateParts(now);
    const [targetYear, targetMonth] = month
      ? month.split('-').map(Number)
      : [today.year, today.month];
    return {
      label: `Tháng ${targetMonth}/${targetYear}`,
      range: {
        gte: organizationDateStart(targetYear, targetMonth, 1),
        lt: organizationDateStart(targetYear, targetMonth + 1, 1),
      },
    };
  }

  const start = dateFrom ? parseReportDay(dateFrom) : undefined;
  const end = dateTo ? parseReportDay(dateTo) : undefined;
  if (!start && !end) {
    throw new BadRequestException('Chọn ngày bắt đầu hoặc ngày kết thúc.');
  }
  if (start && end && start.date > end.date) {
    throw new BadRequestException(
      'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
    );
  }
  return {
    label: [
      start && `Từ ${reportDateFormat.format(start.date)}`,
      end && `${start ? 'đến' : 'Đến'} ${reportDateFormat.format(end.date)}`,
    ]
      .filter(Boolean)
      .join(' '),
    range: {
      ...(start && { gte: start.date }),
      ...(end && { lt: end.nextDay }),
    },
  };
}

function summarize(tasks: ReportTaskItem[]) {
  const count = (status: TaskStatus) =>
    tasks.filter((task) => task.status === status).length;
  const total = tasks.length;
  const completedEarly = count('COMPLETED_EARLY');
  const completedOnTime = count('COMPLETED_ON_TIME');
  const completedLate = count('COMPLETED_LATE');
  const totalCompleted = completedEarly + completedOnTime + completedLate;
  const cancelled = count('CANCELLED');
  const noEvaluation = count('NO_EVALUATION');
  const eligible = total - cancelled - noEvaluation;
  return {
    total,
    completedEarly,
    completedOnTime,
    completedLate,
    totalCompleted,
    inProgress: count('IN_PROGRESS'),
    incomplete: count('INCOMPLETE'),
    cancelled,
    noEvaluation,
    completionRate:
      eligible > 0 ? Math.round((totalCompleted / eligible) * 100) : 0,
    onTimeRate:
      totalCompleted > 0
        ? Math.round(
            ((completedEarly + completedOnTime) / totalCompleted) * 100,
          )
        : 0,
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getOfficialStatus(
    task: {
      isCancelled: boolean;
      requiredCompletionDate: Date | null;
      actualCompletionDate: Date | null;
      approvedStatus: string | null;
    },
    now: Date,
  ): TaskStatus {
    if (task.isCancelled) return 'CANCELLED';
    return (
      (task.approvedStatus as TaskStatus) ??
      calculateTaskStatus({ ...task, now })
    );
  }

  async getReportData(dto: ReportQueryDto) {
    const now = new Date();
    const period = buildPeriod(dto, now);
    const where: Prisma.TaskWhereInput = {
      ownerDepartmentId: dto.departmentId || undefined,
    };

    if (period.range) {
      where.OR = [
        { requiredCompletionDate: period.range },
        { requiredCompletionDate: null, assignedDate: period.range },
      ];
    }

    const search = dto.search?.trim() ?? '';
    if (search) {
      const match = { contains: search, mode: 'insensitive' } as const;
      where.AND = {
        OR: [
          { title: match },
          { content: match },
          { documentNumber: match },
          { ownerDepartment: { name: match } },
          { assignedBy: match },
        ],
      };
    }

    const [records, department] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          ownerDepartment: { select: { name: true } },
          feedbacks: {
            where: { type: 'DIRECTIVE' },
            select: { content: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [
          { requiredCompletionDate: 'asc' },
          { assignedDate: 'desc' },
          { id: 'asc' },
        ],
      }),
      dto.departmentId
        ? this.prisma.department.findUnique({
            where: { id: dto.departmentId },
            select: { name: true },
          })
        : null,
    ]);

    if (dto.departmentId && !department) {
      throw new BadRequestException('Đơn vị đã chọn không tồn tại.');
    }

    const statusGroup = dto.statusGroup ?? 'ALL';
    const tasks: ReportTaskItem[] = [];
    for (const task of records) {
      const status = this.getOfficialStatus(task, now);
      if (statusGroup === 'COMPLETED' && !COMPLETED_STATUSES.includes(status))
        continue;
      if (
        statusGroup !== 'ALL' &&
        statusGroup !== 'COMPLETED' &&
        statusGroup !== status
      )
        continue;

      tasks.push({
        id: task.id,
        taskCode: task.taskCode,
        title: task.title,
        content: task.content,
        documentNumber: task.documentNumber,
        priority: task.priority,
        ownerDepartmentId: task.ownerDepartmentId,
        ownerDepartmentName: task.ownerDepartment.name,
        coordinatingUnits: task.coordinatingUnits,
        assignedDate: task.assignedDate,
        assignedBy: task.assignedBy,
        requiredCompletionDate: task.requiredCompletionDate,
        actualCompletionDate: task.actualCompletionDate,
        status,
        statusLabel: getStatusLabel(status),
        completionEvidence: task.completionEvidence,
        incompleteReason: task.incompleteReason,
        isFinalized: task.isFinalized,
        directives: task.feedbacks.map((feedback) => feedback.content),
      });
    }

    return {
      summary: summarize(tasks),
      tasks,
      scope: {
        period: period.label,
        department: department?.name ?? 'Toàn cơ quan',
        status:
          statusGroup === 'ALL'
            ? 'Tất cả trạng thái'
            : statusGroup === 'COMPLETED'
              ? 'Đã hoàn thành'
              : getStatusLabel(statusGroup),
        search,
      },
    };
  }

  async exportExcel(dto: ReportQueryDto, res: Response) {
    const { summary, tasks, scope } = await this.getReportData(dto);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống Quản lý Nhiệm vụ GTTM';
    workbook.created = new Date();

    const tableHeaderRowIndex = 10;
    const sheet = workbook.addWorksheet('Báo cáo nhiệm vụ', {
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: `${tableHeaderRowIndex}:${tableHeaderRowIndex}`,
      },
      views: [{ showGridLines: false }],
    });

    // 1. Header Section
    sheet.mergeCells('A1:C1');
    const orgCell = sheet.getCell('A1');
    orgCell.value = 'CỤC ĐƯỜNG BỘ VIỆT NAM';
    orgCell.font = { name: 'Times New Roman', size: 11, bold: true };
    orgCell.alignment = { horizontal: 'left', vertical: 'middle' };

    sheet.mergeCells('G1:J1');
    const nationalCell = sheet.getCell('G1');
    nationalCell.value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    nationalCell.font = { name: 'Times New Roman', size: 11, bold: true };
    nationalCell.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('G2:J2');
    const mottoCell = sheet.getCell('G2');
    mottoCell.value = 'Độc lập - Tự do - Hạnh phúc';
    mottoCell.font = { name: 'Times New Roman', size: 10, italic: true };
    mottoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 2. Title Section
    sheet.mergeCells('A4:J4');
    const titleCell = sheet.getCell('A4');
    titleCell.value = 'BÁO CÁO THEO DÕI VÀ ĐÁNH GIÁ THỰC HIỆN NHIỆM VỤ';
    titleCell.font = {
      name: 'Times New Roman',
      size: 16,
      bold: true,
      color: { argb: 'FF1E3A8A' },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Period Description
    sheet.mergeCells('A5:J5');
    const periodCell = sheet.getCell('A5');
    periodCell.value = `Kỳ báo cáo: ${scope.period} · Đơn vị: ${scope.department} · Trạng thái: ${scope.status}`;
    periodCell.font = { name: 'Times New Roman', size: 11, italic: true };
    periodCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    sheet.getRow(5).height = 26;
    if (scope.search) {
      sheet.mergeCells('A6:J6');
      const searchCell = sheet.getCell('A6');
      searchCell.value = `Từ khóa: ${scope.search}`;
      searchCell.font = periodCell.font;
      searchCell.alignment = periodCell.alignment;
      sheet.getRow(6).height = 30;
    }

    // 3. Summary Stats Table
    const summaryHeaders = [
      'Tổng số',
      'Trước hạn',
      'Đúng hạn',
      'Quá hạn đã xong',
      'Đang thực hiện',
      'Không hoàn thành',
      'Đã hủy',
      'Không đánh giá',
      'Tỷ lệ xử lý',
      'Tỷ lệ đúng hạn',
    ];
    sheet.getRow(7).values = summaryHeaders;
    sheet.getRow(8).values = [
      summary.total,
      summary.completedEarly,
      summary.completedOnTime,
      summary.completedLate,
      summary.inProgress,
      summary.incomplete,
      summary.cancelled,
      summary.noEvaluation,
      summary.completionRate / 100,
      summary.onTimeRate / 100,
    ];
    sheet.getCell('I8').numFmt = '0%';
    sheet.getCell('J8').numFmt = '0%';

    const sumHeaderRow = sheet.getRow(7);
    sumHeaderRow.height = 28;
    sumHeaderRow.font = {
      name: 'Times New Roman',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    for (let c = 1; c <= summaryHeaders.length; c++) {
      const cell = sumHeaderRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }

    const sumValRow = sheet.getRow(8);
    sumValRow.font = { name: 'Times New Roman', size: 11, bold: true };
    for (let c = 1; c <= summaryHeaders.length; c++) {
      const cell = sumValRow.getCell(c);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }

    // 4. Detailed Tasks Table
    const headers = [
      'STT',
      'Số văn bản',
      'Nội dung nhiệm vụ',
      'Đơn vị chủ trì',
      'Đơn vị phối hợp',
      'Hạn hoàn thành',
      'Ngày hoàn thành TT',
      'Trạng thái đánh giá',
      'Tiến độ / Bằng chứng',
      'Ý kiến chỉ đạo',
    ];

    sheet.getRow(tableHeaderRowIndex).values = headers;
    const tableHeader = sheet.getRow(tableHeaderRowIndex);
    tableHeader.font = {
      name: 'Times New Roman',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    tableHeader.height = 28;

    for (let col = 1; col <= headers.length; col++) {
      const cell = tableHeader.getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    }

    // Populate task rows
    const formatDate = (date: Date | null) =>
      date ? reportDateFormat.format(date) : '-';

    tasks.forEach((task, idx) => {
      const rowIdx = tableHeaderRowIndex + 1 + idx;
      const row = sheet.getRow(rowIdx);
      row.values = [
        idx + 1,
        task.documentNumber || '-',
        [task.title, task.content].filter(Boolean).join('\n'),
        task.ownerDepartmentName,
        task.coordinatingUnits || '-',
        formatDate(task.requiredCompletionDate),
        formatDate(task.actualCompletionDate),
        task.statusLabel,
        [task.completionEvidence, task.incompleteReason]
          .filter(Boolean)
          .join('\n') || '-',
        task.directives.join('\n') || '-',
      ];

      row.font = { name: 'Times New Roman', size: 10 };
      row.alignment = { vertical: 'middle', wrapText: true };

      for (let c = 1; c <= headers.length; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }

      // Column specific alignments
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

      // Status color highlights
      const statusCell = row.getCell(8);
      if (['COMPLETED_EARLY', 'COMPLETED_ON_TIME'].includes(task.status)) {
        statusCell.font = {
          name: 'Times New Roman',
          size: 10,
          bold: true,
          color: { argb: 'FF15803D' },
        };
      } else if (task.status === 'COMPLETED_LATE') {
        statusCell.font = {
          name: 'Times New Roman',
          size: 10,
          bold: true,
          color: { argb: 'FFC2410C' },
        };
      } else if (task.status === 'INCOMPLETE' || task.status === 'CANCELLED') {
        statusCell.font = {
          name: 'Times New Roman',
          size: 10,
          bold: true,
          color: { argb: 'FFB91C1C' },
        };
      } else if (task.status === 'IN_PROGRESS') {
        statusCell.font = {
          name: 'Times New Roman',
          size: 10,
          bold: true,
          color: { argb: 'FF1D4ED8' },
        };
      }
    });

    // Column Widths — dùng getColumn() để tránh ExcelJS reset rows khi set sheet.columns sau
    sheet.getColumn(1).width = 6; // STT
    sheet.getColumn(2).width = 13; // Số VB
    sheet.getColumn(3).width = 37; // Nội dung
    sheet.getColumn(4).width = 19; // Đơn vị chủ trì
    sheet.getColumn(5).width = 16; // Phối hợp
    sheet.getColumn(6).width = 12; // Hạn HT
    sheet.getColumn(7).width = 12; // Thực tế HT
    sheet.getColumn(8).width = 16; // Trạng thái
    sheet.getColumn(9).width = 51; // Tiến độ/Bằng chứng
    sheet.getColumn(10).width = 21; // Ý kiến chỉ đạo

    // Signatures
    const finalRowIdx = tableHeaderRowIndex + tasks.length + 3;
    sheet.mergeCells(`H${finalRowIdx}:J${finalRowIdx}`);
    const signDateCell = sheet.getCell(`H${finalRowIdx}`);
    const { day, month, year } = organizationDateParts(workbook.created);
    signDateCell.value = `Ngày ${day} tháng ${month} năm ${year}`;
    signDateCell.font = { name: 'Times New Roman', size: 11, italic: true };
    signDateCell.alignment = { horizontal: 'center' };

    sheet.mergeCells(`A${finalRowIdx + 1}:C${finalRowIdx + 1}`);
    const makerCell = sheet.getCell(`A${finalRowIdx + 1}`);
    makerCell.value = 'NGƯỜI LẬP BIỂU';
    makerCell.font = { name: 'Times New Roman', size: 11, bold: true };
    makerCell.alignment = { horizontal: 'center' };

    sheet.mergeCells(`H${finalRowIdx + 1}:J${finalRowIdx + 1}`);
    const leaderCell = sheet.getCell(`H${finalRowIdx + 1}`);
    leaderCell.value = 'THỦ TRƯỞNG ĐƠN VỊ';
    leaderCell.font = { name: 'Times New Roman', size: 11, bold: true };
    leaderCell.alignment = { horizontal: 'center' };

    // Write to stream
    const fileName = `Bao_cao_nhiem_vu_${Date.now()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
