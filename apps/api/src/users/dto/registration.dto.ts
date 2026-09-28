import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;
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
