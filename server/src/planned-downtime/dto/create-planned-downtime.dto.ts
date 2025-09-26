import { PartialType } from '@nestjs/mapped-types';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// create-planned-downtime.dto.ts
export class CreatePlannedDowntimeDto {
  @IsString()
  @IsNotEmpty()
  machine_number: string;

  @IsDateString()
  date: string;

  @IsEnum(['day', 'night', 'all'])
  shift: string;

  @IsNumber()
  @Min(0)
  planned_downtime_minutes: number;

  @IsEnum([
    'maintenance',
    'setup',
    'break',
    'material_change',
    'cleaning',
    'other',
  ])
  downtime_type: string;

  @IsOptional()
  @IsString()
  description?: string;
}
