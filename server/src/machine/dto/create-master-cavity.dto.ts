// src/dto/create-master-cavity.dto.ts
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateMasterCavityDto {
  @IsNotEmpty()
  @IsString()
  material_number: string;

  @IsNotEmpty()
  @IsString()
  material_description: string;

  @IsOptional()
  @IsString()
  part_number_1?: string;

  @IsOptional()
  @IsString()
  part_number_2?: string;

  @IsOptional()
  @IsString()
  part_name_1?: string;

  @IsOptional()
  @IsString()
  part_name_2?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsNotEmpty()
  @IsNumber()
  cavity: number;

  @IsNotEmpty()
  @IsNumber()
  weight: number;

  @IsNotEmpty()
  @IsNumber()
  runner: number;

  @IsNotEmpty()
  @IsNumber()
  tonnage: number;

  @IsNotEmpty()
  @IsNumber()
  cycle_time: number;

  @IsOptional()
  @IsString()
  customer?: string;
}
