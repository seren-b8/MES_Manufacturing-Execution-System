import { PartialType } from '@nestjs/mapped-types';
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
  is_co_product?: boolean;
}

export class UpdateMasterPartDto extends PartialType(CreateMasterPartDto) {}
