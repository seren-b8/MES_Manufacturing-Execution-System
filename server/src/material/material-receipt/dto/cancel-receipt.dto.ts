// src/material-receipt/dto/cancel-receipt.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelReceiptDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}
