// src/oee/dto/oee-query.dto.ts
import { IsOptional, IsString, IsArray, IsEnum } from 'class-validator';

export class OEEQueryDto {
  @IsOptional()
  @IsString()
  date?: string; // YYYY-MM-DD

  @IsOptional()
  @IsEnum(['day', 'night', ''], {
    message: 'shift must be either day or night',
  })
  shift?: 'day' | 'night' | '';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  machine_numbers?: string[];
}
