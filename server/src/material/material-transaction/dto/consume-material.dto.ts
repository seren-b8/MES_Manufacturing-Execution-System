// consume-material.dto.ts
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConsumeMaterialDto {
  @IsString()
  material_number: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  machine_number: string; // ← เปลี่ยนเป็น required

  @IsString()
  from_location_code: string;

  @IsString()
  @IsOptional()
  from_position_code?: string;

  @IsString()
  @IsOptional()
  lot_number?: string;

  @IsString()
  @IsOptional()
  reference_doc?: string;

  @IsOptional()
  user_id?: string;

  @IsOptional()
  @Type(() => Date)
  transaction_date?: Date;
}
