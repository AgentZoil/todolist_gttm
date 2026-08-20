import { IsString, IsNotEmpty, IsOptional, IsDateString, IsUUID, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  source: string;

  @IsDateString()
  @IsNotEmpty()
  assignedDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  assignedBy: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  coordinatingUnits?: string;

  @IsUUID()
  @IsNotEmpty()
  ownerDepartmentId: string;

  @IsDateString()
  @IsOptional()
  requiredCompletionDate?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  source?: string;

  @IsDateString()
  @IsOptional()
  assignedDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  assignedBy?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  documentNumber?: string;

  @IsUUID()
  @IsOptional()
  ownerDepartmentId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  coordinatingUnits?: string;

  @IsDateString()
  @IsOptional()
  requiredCompletionDate?: string;

  @IsDateString()
  @IsOptional()
  actualCompletionDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  completionEvidence?: string;

  @IsOptional()
  expectedVersion?: number;
}
