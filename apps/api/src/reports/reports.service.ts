import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateTaskStatus,
  getStatusLabel,
  organizationDateParts,
  organizationDateStart,
  TaskStatus,
} from '../tasks/status';
import { ReportQueryDto } from './dto/report-query.dto';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

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

export interface ReportSummaryStats {
  total: number;
  completedEarly: number;
  completedOnTime: number;
  completedLate: number;
  totalCompleted: number;
  inProgress: number;
  incomplete: number;
  cancelled: number;
  noEvaluation: number;
  completionRate: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildDateRange(dto: ReportQueryDto): { startDate: Date; endDate: Date } | null {
    const { dateFilterType = 'ALL', year, month, dateFrom, dateTo } = dto;

    if (dateFilterType === 'ALL') {
      return null;
    }

    if (dateFilterType === 'YEAR') {
      const targetYear = Number(year) || new Date().getFullYear();
      const startDate = organizationDateStart(targetYear, 1, 1);
      const endDate = new Date(organizationDateStart(targetYear + 1, 1, 1).getTime() - 1);
      return { startDate, endDate };
    }

    if (dateFilterType === 'MONTH') {
      let targetYear: number;
      let targetMonth: number;
      if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        [targetYear, targetMonth] = month.split('-').map(Number);
      } else {
        const today = organizationDateParts(new Date());
        targetYear = today.year;
        targetMonth = today.month;
      }
      const startDate = organizationDateStart(targetYear, targetMonth, 1);
      const endDate = new Date(organizationDateStart(targetYear, targetMonth + 1, 1).getTime() - 1);
      return { startDate, endDate };
    }

    if (dateFilterType === 'CUSTOM') {
      if (!dateFrom && !dateTo) {
        return null;
      }
      const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : new Date('1970-01-01');
      const endDate = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : new Date('2099-12-31');
      return { startDate, endDate };
    }

    return null;
  }

  private getOfficialStatus(task: {
    isCancelled: boolean;
    requiredCompletionDate: Date | null;
    actualCompletionDate: Date | null;
    approvedStatus: string | null;
  }): TaskStatus {
    if (task.isCancelled) return 'CANCELLED';
    return (task.approvedStatus as TaskStatus) ?? calculateTaskStatus(task);
  }

  async getReportData(dto: ReportQueryDto) {
    const dateRange = this.buildDateRange(dto);
    const where: any = {};

    if (dateRange) {
      where.OR = [
        {
          requiredCompletionDate: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
        {
          requiredCompletionDate: null,
          assignedDate: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      ];
    }

    if (dto.departmentId) {
      where.ownerDepartmentId = dto.departmentId;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        ownerDepartment: {
          select: { id: true, name: true, code: true },
        },
        feedbacks: {
          where: { type: 'DIRECTIVE' },
          select: { content: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [
        { requiredCompletionDate: 'asc' },
        { assignedDate: 'desc' },
      ],
    });

    const enrichedTasks: ReportTaskItem[] = tasks.map((task) => {
      const status = this.getOfficialStatus(task);
      return {
        id: task.id,
        taskCode: task.taskCode,
        title: task.title,
        content: task.content,
        documentNumber: task.documentNumber,
        priority: task.priority,
        ownerDepartmentId: task.ownerDepartmentId,
        ownerDepartmentName: task.ownerDepartment?.name || 'Chưa phân công',
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
        directives: task.feedbacks.map((f) => f.content),
      };
    });

    // Compute Summary for the period/department
    let completedEarly = 0;
    let completedOnTime = 0;
    let completedLate = 0;
    let inProgress = 0;
    let incomplete = 0;
    let cancelled = 0;
    let noEvaluation = 0;

    for (const t of enrichedTasks) {
      switch (t.status) {
        case 'COMPLETED_EARLY':
          completedEarly++;
          break;
        case 'COMPLETED_ON_TIME':
          completedOnTime++;
          break;
        case 'COMPLETED_LATE':
          completedLate++;
          break;
        case 'IN_PROGRESS':
          inProgress++;
          break;
        case 'INCOMPLETE':
          incomplete++;
          break;
        case 'CANCELLED':
          cancelled++;
          break;
        case 'NO_EVALUATION':
          noEvaluation++;
          break;
      }
    }

    const total = enrichedTasks.length;
    const totalCompleted = completedEarly + completedOnTime + completedLate;
    const completionRate = total > 0 ? Math.round((totalCompleted / (total - cancelled || 1)) * 100) : 0;

    const summary: ReportSummaryStats = {
      total,
      completedEarly,
      completedOnTime,
      completedLate,
      totalCompleted,
      inProgress,
      incomplete,
      cancelled,
      noEvaluation,
      completionRate,
    };

    // Filter by statusGroup if specified
    let filteredTasks = enrichedTasks;
    if (dto.statusGroup && dto.statusGroup !== 'ALL') {
      if (dto.statusGroup === 'COMPLETED') {
        filteredTasks = enrichedTasks.filter((t) =>
          ['COMPLETED_EARLY', 'COMPLETED_ON_TIME', 'COMPLETED_LATE'].includes(t.status),
        );
      } else if (dto.statusGroup === 'IN_PROGRESS') {
        filteredTasks = enrichedTasks.filter((t) => t.status === 'IN_PROGRESS');
      } else if (dto.statusGroup === 'INCOMPLETE') {
        filteredTasks = enrichedTasks.filter((t) => t.status === 'INCOMPLETE');
      } else if (dto.statusGroup === 'CANCELLED') {
        filteredTasks = enrichedTasks.filter((t) => t.status === 'CANCELLED');
      }
    }

    return {
      summary,
      tasks: filteredTasks,
    };
  }

  async exportExcel(dto: ReportQueryDto, res: Response) {
    const { summary, tasks } = await this.getReportData(dto);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống Quản lý Nhiệm vụ GTTM';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Báo cáo nhiệm vụ', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      views: [{ showGridLines: true }],
    });

    // 1. Header Section
    sheet.mergeCells('A1:C1');
    const orgCell = sheet.getCell('A1');
    orgCell.value = 'HỆ THỐNG QUẢN LÝ NHIỆM VỤ GTTM';
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
    titleCell.font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Period Description
    let periodText = 'Thời gian: Toàn thời gian';
    if (dto.dateFilterType === 'YEAR') {
      periodText = `Thời gian: Năm ${dto.year || new Date().getFullYear()}`;
    } else if (dto.dateFilterType === 'MONTH') {
      periodText = `Thời gian: Tháng ${dto.month || ''}`;
    } else if (dto.dateFilterType === 'CUSTOM') {
      periodText = `Thời gian: Từ ${dto.dateFrom || '...'} đến ${dto.dateTo || '...'}`;
    }

    sheet.mergeCells('A5:J5');
    const periodCell = sheet.getCell('A5');
    periodCell.value = periodText;
    periodCell.font = { name: 'Times New Roman', size: 11, italic: true };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 3. Summary Stats Table
    sheet.getRow(7).values = ['Tổng số nhiệm vụ', 'Hoàn thành trước hạn', 'Hoàn thành đúng hạn', 'Hoàn thành quá hạn', 'Đang thực hiện', 'Không hoàn thành', 'Đã hủy', 'Tỷ lệ hoàn thành'];
    sheet.getRow(8).values = [
      summary.total,
      summary.completedEarly,
      summary.completedOnTime,
      summary.completedLate,
      summary.inProgress,
      summary.incomplete,
      summary.cancelled,
      `${summary.completionRate}%`,
    ];

    const sumHeaderRow = sheet.getRow(7);
    sumHeaderRow.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    for (let c = 1; c <= 8; c++) {
      const cell = sumHeaderRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }

    const sumValRow = sheet.getRow(8);
    sumValRow.font = { name: 'Times New Roman', size: 11, bold: true };
    for (let c = 1; c <= 8; c++) {
      const cell = sumValRow.getCell(c);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }

    // 4. Detailed Tasks Table
    const tableHeaderRowIndex = 10;
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
    tableHeader.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    tableHeader.height = 28;

    for (let col = 1; col <= headers.length; col++) {
      const cell = tableHeader.getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    }

    // Populate task rows
    const formatDate = (date: Date | null) => {
      if (!date) return '-';
      const d = new Date(date);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    tasks.forEach((task, idx) => {
      const rowIdx = tableHeaderRowIndex + 1 + idx;
      const row = sheet.getRow(rowIdx);
      row.values = [
        idx + 1,
        task.documentNumber || '-',
        task.title,
        task.ownerDepartmentName,
        task.coordinatingUnits || '-',
        formatDate(task.requiredCompletionDate),
        formatDate(task.actualCompletionDate),
        task.statusLabel,
        task.completionEvidence || task.incompleteReason || '-',
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
        statusCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF15803D' } };
      } else if (task.status === 'COMPLETED_LATE') {
        statusCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFC2410C' } };
      } else if (task.status === 'INCOMPLETE' || task.status === 'CANCELLED') {
        statusCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
      } else if (task.status === 'IN_PROGRESS') {
        statusCell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
      }
    });

    // Column Widths
    sheet.columns = [
      { width: 6 },  // STT
      { width: 16 }, // Số VB
      { width: 40 }, // Nội dung
      { width: 22 }, // Đơn vị chủ trì
      { width: 20 }, // Phối hợp
      { width: 14 }, // Hạn HT
      { width: 14 }, // Thực tế HT
      { width: 18 }, // Trạng thái
      { width: 28 }, // Tiến độ/Bằng chứng
      { width: 25 }, // Ý kiến chỉ đạo
    ];

    // Signatures
    const finalRowIdx = tableHeaderRowIndex + tasks.length + 3;
    sheet.mergeCells(`H${finalRowIdx}:J${finalRowIdx}`);
    const signDateCell = sheet.getCell(`H${finalRowIdx}`);
    const today = new Date();
    signDateCell.value = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
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
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
