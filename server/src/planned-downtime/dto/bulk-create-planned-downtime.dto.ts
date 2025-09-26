import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
export class BulkCreatePlannedDowntimeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => String)
  machine_numbers: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => String)
  @IsDateString({}, { each: true })
  dates: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsEnum(['day', 'night', 'all'], { each: true })
  shifts: string[];

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
