// src/material/dto/create-material.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

export class InitialStockDto {
  @IsString()
  @IsNotEmpty()
  location_id: string;

  @IsOptional()
  @IsString()
  position_code?: string; // เพิ่ม position support

  @IsNumber()
  @Min(0)
  stock_quantity: number;

  @IsOptional()
  @IsString()
  lot_number?: string; // เพิ่ม lot tracking
}

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  material_number: string;

  @IsString()
  @IsNotEmpty()
  material_description: string;

  @IsOptional()
  @IsString()
  unit_of_measurement?: string; // เพิ่ม unit

  @IsOptional()
  @IsNumber()
  @Min(0)
  standard_cost?: number; // เพิ่ม cost tracking

  @IsOptional()
  @IsString()
  material_type?: string; // เพิ่ม material type

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialStockDto)
  initial_stock?: InitialStockDto[];
}
