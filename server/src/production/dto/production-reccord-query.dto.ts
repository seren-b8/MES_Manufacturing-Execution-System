// production-record-query.dto.ts
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Types } from 'mongoose';

export class ProductionRecordQueryDto {
  @IsOptional()
  @IsString()
  machine_number?: string;

  @IsOptional()
  @IsString()
  material_number?: string;

  @IsOptional()
  assign_order_id?: string | Types.ObjectId;

  // รับได้ทั้ง string และ boolean
  @IsOptional()
  is_not_good?: string | boolean;

  @IsOptional()
  is_synced_to_sap?: string | boolean;

  @IsOptional()
  @IsEnum(['pending', 'confirmed', 'rejected'])
  confirmation_status?: 'pending' | 'confirmed' | 'rejected';

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  production_date?: string;

  @IsOptional()
  @IsString()
  employee_id?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: string | number;

  @IsOptional()
  limit?: string | number;
}
