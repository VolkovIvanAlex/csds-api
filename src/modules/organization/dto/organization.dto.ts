import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
} from 'class-validator';

export class OrganizationCreateDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class OrganizationUpdateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  userIds?: string[];
}