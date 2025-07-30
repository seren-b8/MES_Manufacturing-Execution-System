import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  Min,
  ValidateNested,
  IsEnum,
  IsArray,
  IsInt,
  IsDefined,
} from 'class-validator';
import { Type } from 'class-transformer';

// generate-label.dto.ts
// export class GenerateLabelDto {
//   production_record_ids: string[];
//   co_product_record_ids?: string[];
//   label_type:
//     | '1_part'
//     | '2_part'
//     | 'co_product_combined'
//     | 'co_product_separate';
//   printer_id: string;
//   position_mapping?: {
//     position_1: { type: 'main' | 'co'; record_id: string };
//     position_2?: { type: 'main' | 'co'; record_id: string };
//   };
//   copies?: number;
// }

export class PositionMappingDetailDto {
  @IsEnum(['main', 'co'])
  type: 'main' | 'co';

  @IsString()
  @IsDefined() // Ensure record_id is provided when PositionMappingDetailDto is used
  record_id: string;
}

export class PositionMappingDto {
  @ValidateNested()
  @Type(() => PositionMappingDetailDto)
  @IsDefined() // Ensure position_1 is defined
  position_1: PositionMappingDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionMappingDetailDto)
  position_2?: PositionMappingDetailDto;
}

export class GenerateLabelDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true }) // Each item in the array must be a string
  production_record_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  co_product_record_ids?: string[];

  @IsEnum(['1_part', '2_part', 'co_product_combined', 'co_product_separate'])
  label_type:
    | '1_part'
    | '2_part'
    | 'co_product_combined'
    | 'co_product_separate';

  @IsString()
  printer_id: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionMappingDto) // Crucial for nested objects
  position_mapping?: PositionMappingDto;

  @IsOptional()
  @IsInt()
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
  customer?: string;

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
