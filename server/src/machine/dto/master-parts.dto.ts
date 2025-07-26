import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class CreateMasterPartDto {
  @IsNotEmpty()
  @IsString()
  material_number: string;

  @IsOptional()
  @IsString()
  material_description?: string;

  @IsOptional()
  @IsString()
  part_number?: string;

  @IsOptional()
  @IsString()
  part_name?: string;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }
    return value;
  })
  weight: number;

  @IsOptional()
  @IsString()
  part_model?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  co_product_material?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    if (typeof value === 'number') {
      return Boolean(value);
    }
    return value;
  })
  is_co_product?: boolean;
}

export class UpdateMasterPartDto extends PartialType(CreateMasterPartDto) {}
