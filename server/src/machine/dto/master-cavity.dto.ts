import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  ValidateNested,
  IsArray,
} from 'class-validator';

// create-master-cavity.dto.ts
export class CreatePartDto {
  @IsNotEmpty()
  @IsString()
  material_number: string;

  @IsString()
  @IsOptional()
  material_description?: string;

  @IsString()
  @IsOptional()
  part_number?: string;

  @IsString()
  @IsOptional()
  part_name?: string;

  @IsNumber()
  @IsNotEmpty()
  weight: number;
}

export class CreateMasterCavityDto {
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreatePartDto)
  parts: CreatePartDto[];

  @IsNotEmpty()
  @IsNumber()
  cavity: number;

  @IsNotEmpty()
  @IsNumber()
  runner: number;

  @IsNumber()
  @IsOptional()
  tonnage?: number;

  @IsNumber()
  @IsOptional()
  cycle_time?: number;

  @IsString()
  @IsOptional()
  customer?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

// update-master-cavity.dto.ts
export class UpdatePartDto extends PartialType(CreatePartDto) {}

export class UpdateMasterCavityDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdatePartDto)
  parts?: UpdatePartDto[];

  @IsNumber()
  @IsOptional()
  cavity?: number;

  @IsNumber()
  @IsOptional()
  runner?: number;

  @IsNumber()
  @IsOptional()
  tonnage?: number;

  @IsNumber()
  @IsOptional()
  cycle_time?: number;

  @IsString()
  @IsOptional()
  customer?: string;

  @IsString()
  @IsOptional()
  color?: string;
}

export class CreateFromPartsDto extends OmitType(CreateMasterCavityDto, [
  'parts',
] as const) {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  material_numbers: string[];
}
