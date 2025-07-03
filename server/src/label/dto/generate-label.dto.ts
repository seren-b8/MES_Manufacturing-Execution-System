import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// generate-label.dto.ts
export class GenerateLabelDto {
  production_record_ids: string[];
  co_product_record_ids?: string[];
  label_type:
    | '1_part'
    | '2_part'
    | 'co_product_combined'
    | 'co_product_separate';
  printer_id: string;
  position_mapping?: {
    position_1: { type: 'main' | 'co'; record_id: string };
    position_2?: { type: 'main' | 'co'; record_id: string };
  };
  copies?: number;
}

export class PartDataDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsNotEmpty()
  @IsString()
  sapNo: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNotEmpty()
  @IsString()
  serial: string;

  @IsOptional()
  @IsString()
  partImage?: string;
}

export class LabelDataDto {
  @IsOptional()
  @IsString()
  labelNo?: string;

  @IsNotEmpty()
  @IsString()
  customer: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  mat?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  producer?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @ValidateNested()
  @Type(() => PartDataDto)
  part1: PartDataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PartDataDto)
  part2?: PartDataDto;
}
