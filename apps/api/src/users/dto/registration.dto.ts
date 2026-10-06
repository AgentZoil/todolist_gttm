import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterUserDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  confirmPassword: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roleId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string | null;
}

export class ApproveRegistrationDto {
  @IsString()
  @IsNotEmpty()
  roleId: string;

  @IsString()
  @IsOptional()
  departmentId?: string;
}

export class RejectRegistrationDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
