import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsBoolean,
  IsString,
  IsInt,
  IsEnum,
} from 'class-validator';

export class ProductionRecordQueryDto {
  // Machine & Material
  @IsOptional()
  @IsString()
  machine_number?: string;

  @IsOptional()
  @IsString()
  material_number?: string;

  // Boolean fields - Transform string to boolean
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_not_good?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_synced_to_sap?: boolean;

  // Enum
  @IsOptional()
  @IsEnum(['pending', 'confirmed', 'rejected'])
  confirmation_status?: 'pending' | 'confirmed' | 'rejected';

  // Dates
  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  production_date?: string;

  // Employee
  @IsOptional()
  @IsString()
  employee_id?: string;

  // Search
  @IsOptional()
  @IsString()
  search?: string;

  // Pagination - Transform string to number
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  limit?: number;
}
