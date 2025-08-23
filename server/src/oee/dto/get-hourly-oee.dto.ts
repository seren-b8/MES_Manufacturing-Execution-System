// src/oee/dto/get-hourly-oee.dto.ts
import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetHourlyOEEDto {
  @IsOptional()
  @IsString()
  machine_number?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsIn(['day', 'night'])
  shift_type?: 'day' | 'night';

  @IsOptional()
  @Transform(({ value }) => value?.split(','))
  machine_numbers?: string[];
}
