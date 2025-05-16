import { IsDefined, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class LoginWithPrivyDto {
  @IsString()
  @IsNotEmpty()
  @IsDefined()
  privyAccessToken: string;
}

export class RegisterWithPrivyDto {
  @IsString()
  @IsNotEmpty()
  @IsDefined()
  privyAccessToken: string;
}