import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsString,
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

}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roleId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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
