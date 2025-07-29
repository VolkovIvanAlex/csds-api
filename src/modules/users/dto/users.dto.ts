import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsDefined
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class UserCreateDto {
  @IsString()
  @IsNotEmpty()
  @IsDefined()
  privyAccessToken: string;

  @IsString()
  @IsOptional()
  role: UserRole | null | undefined;

  @IsString()
  @IsOptional()
  name: string;

  @IsEmail()
  @IsOptional()
  email: string;

  @IsInt()
  @IsOptional()
  submissionQuatity: number;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsOptional()
  photo?: string;

  @IsString()
  @IsOptional()
  jobTitle?: string;
}

export class UserUpdateDto {
  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsInt()
  @IsOptional()
  submissionQuatity?: number;

  @IsString()
  @IsOptional()
  photo?: string;

  @IsString()
  @IsOptional()
  jobTitle?: string;
}

export class UserCheckDto {
  name: string;
  email: string;
}