// src/material-receipt/dto/process-receipt.dto.ts
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiptItemDto {
  @IsNotEmpty()
  @IsString()
  location_id: string;

  @IsOptional()
  @IsString()
  position_id?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  lot_number?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class ProcessReceiptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  items: ReceiptItemDto[];
}
