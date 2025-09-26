// src/material/dto/position-stock.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

export class PositionStockDto {
  @IsString()
  @IsNotEmpty()
  material_id: string;

  @IsString()
  @IsNotEmpty()
  location_id: string;

  @IsString()
  @IsNotEmpty()
  position_code: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  lot_number?: string;
}
