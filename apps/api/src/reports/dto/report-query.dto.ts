export class ReportQueryDto {
  dateFilterType?: 'ALL' | 'YEAR' | 'MONTH' | 'CUSTOM';
  year?: string;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  statusGroup?: 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'INCOMPLETE' | 'CANCELLED';
}
