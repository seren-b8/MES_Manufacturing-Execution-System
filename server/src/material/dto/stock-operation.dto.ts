// src/material/dto/stock-operation.dto.ts
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class StockOperationDto {
  @IsString()
  @IsNotEmpty()
  material_id: string;

  @IsString()
  @IsNotEmpty()
  location_id: string;

  @IsNumber()
  @Min(0)
  quantity: number;
}

export class TransferStockDto {
  @IsString()
  @IsNotEmpty()
  material_id: string;

  @IsString()
  @IsNotEmpty()
  from_location_id: string;

  @IsString()
  @IsNotEmpty()
  to_location_id: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;
}
