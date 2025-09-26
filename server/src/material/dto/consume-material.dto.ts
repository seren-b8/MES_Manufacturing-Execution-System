// src/material/dto/consume-material.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

export class ConsumeMaterialDto {
  @IsString()
  @IsNotEmpty()
  material_id: string;

  @IsString()
  @IsNotEmpty()
  from_location_id: string;

  @IsOptional()
  @IsString()
  from_position_code?: string; // เพิ่ม position support

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsOptional()
  @IsString()
  production_order_id?: string;

  @IsOptional()
  @IsString()
  machine_id?: string;

  @IsOptional()
  @IsString()
  reference_doc?: string;

  @IsOptional()
  @IsString()
  lot_number?: string; // เพิ่ม lot tracking
}
