// src/material/dto/stock-query.dto.ts
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class StockQueryDto {
  @IsOptional()
  @IsString()
  location_id?: string;

  @IsOptional()
  @IsString()
  position_code?: string;

  @IsOptional()
  @IsString()
  lot_number?: string;

  @IsOptional()
  @IsBoolean()
  include_positions?: boolean; // รวม position details หรือไม่

  @IsOptional()
  @IsBoolean()
  group_by_lot?: boolean; // จัดกลุ่มตาม lot หรือไม่
}
