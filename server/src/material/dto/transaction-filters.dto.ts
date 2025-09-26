// src/material/dto/transaction-filters.dto.ts
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export enum TransactionType {
  RECEIVE = 'receive',
  TRANSFER = 'transfer',
  CONSUME = 'consume',
}

export class TransactionFiltersDto {
  @IsOptional()
  @IsString()
  material_id?: string;

  @IsOptional()
  @IsString()
  location_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  transaction_type?: TransactionType;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  production_order_id?: string;

  @IsOptional()
  @IsString()
  machine_id?: string;
}
