import { IsString, IsNotEmpty, IsOptional, IsDateString, IsUUID, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
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
  @IsOptional()
  @MaxLength(50)
  documentNumber?: string;

  @IsUUID()
  @IsNotEmpty()
  ownerDepartmentId: string;

  @IsDateString()
  @IsOptional()
  requiredCompletionDate?: string;

  @IsOptional()
  coordinatingDepartmentIds?: string[];
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
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
