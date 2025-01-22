import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateMasterNotGoodDto {
  @IsNotEmpty()
  @IsString()
  case_english: string;

  @IsNotEmpty()
  @IsString()
  case_thai: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateMasterNotGoodDto {
  @IsOptional()
  @IsString()
  case_english?: string;

  @IsOptional()
  @IsString()
  case_thai?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
