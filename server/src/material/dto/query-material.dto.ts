import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

// src/material/dto/query-material.dto.ts
export class QueryMaterialDto {
  @IsOptional()
  @IsString()
  material_number?: string;

  @IsOptional()
  @IsString()
  material_description?: string;

  @IsOptional()
  @IsString()
  location_code?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  has_stock?: boolean;

  // เพิ่ม
  @IsOptional()
  @IsString()
  unit_of_measurement?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  min_stock?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  max_stock?: number;

  @IsOptional()
  @IsString()
  lot_number?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sort_by?: string = 'material_number';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_order?: 'asc' | 'desc' = 'asc';
}

export class QueryMaterialInventoryDto extends QueryMaterialDto {
  // ใช้ query เดิม + เพิ่ม filter ตาม current_stock ได้
}
