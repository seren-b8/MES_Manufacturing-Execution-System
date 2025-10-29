// src/material-receipt/dto/sync-receipt.dto.ts
import { IsOptional, IsDateString } from 'class-validator';

export class SyncReceiptDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
