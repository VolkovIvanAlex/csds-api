import { IsString, IsNotEmpty, IsArray, IsOptional, IsNumber } from 'class-validator';
export class ReportCreateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  @IsString()
  @IsNotEmpty()
  typeOfThreat: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsNotEmpty()
  severity: string;

  @IsString()
  @IsNotEmpty()
  stix: string;

  @IsString()
  @IsOptional()
  blockchainHash?: string;

  @IsNumber()
  @IsOptional()
  riskScore?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  emailsToShare?: string[];

  @IsString()
  @IsNotEmpty()
  organizationId: string;
}

export class ReportUpdateDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  @IsString()
  @IsOptional()
  typeOfThreat?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  severity?: string;

  @IsString()
  @IsOptional()
  submittedAt?: string;

  @IsString()
  @IsOptional()
  stix?: string;

  @IsString()
  @IsOptional()
  blockchainHash?: string;

  @IsString()
  @IsOptional()
  authorId?: string;

  @IsNumber()
  @IsOptional()
  riskScore?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  emailsToShare?: string[];

  @IsString()
  @IsOptional()
  organizationId?: string;
}