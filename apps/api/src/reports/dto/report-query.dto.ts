import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { TaskStatus } from '../../tasks/status';

const DATE_FILTER_TYPES = ['ALL', 'YEAR', 'MONTH', 'CUSTOM'] as const;
const STATUS_GROUPS = [
  'ALL',
  'COMPLETED',
  'COMPLETED_EARLY',
  'COMPLETED_ON_TIME',
  'COMPLETED_LATE',
  'IN_PROGRESS',
  'INCOMPLETE',
  'CANCELLED',
  'NO_EVALUATION',
] as const satisfies readonly ('ALL' | 'COMPLETED' | TaskStatus)[];

const DATE_PATTERN = /^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class ReportQueryDto {
  @IsOptional()
  @IsIn(DATE_FILTER_TYPES, { message: 'Kiểu kỳ báo cáo không hợp lệ.' })
  dateFilterType?: (typeof DATE_FILTER_TYPES)[number];

  @IsOptional()
  @Matches(/^[1-9]\d{3}$/, { message: 'Năm phải có bốn chữ số.' })
  year?: string;

  @IsOptional()
  @Matches(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/, { message: 'Tháng không hợp lệ.' })
  month?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'Ngày bắt đầu không hợp lệ.' })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'Ngày kết thúc không hợp lệ.' })
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentId?: string;

  @IsOptional()
  @IsIn(STATUS_GROUPS, { message: 'Trạng thái nhiệm vụ không hợp lệ.' })
  statusGroup?: (typeof STATUS_GROUPS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Từ khóa không được vượt quá 200 ký tự.' })
  search?: string;
}
