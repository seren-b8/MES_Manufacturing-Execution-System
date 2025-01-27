import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

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
}

export class UpdateMasterPartDto extends PartialType(CreateMasterPartDto) {}
