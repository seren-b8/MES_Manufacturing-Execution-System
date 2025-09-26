// src/material/dto/update-location.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  Matches,
  MaxLength,
} from 'class-validator';
import { LocationType } from './create-location.dto';

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  location_name?: string;

  @IsEnum(LocationType)
  @IsOptional()
  location_type?: LocationType;

  @IsOptional()
  @IsString()
  parent_location_id?: string;

  @IsBoolean()
  @IsOptional()
  has_positions?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]-\{[a-z_]+\}-\{[a-z_]+\}$/, {
    message: 'Position format must follow pattern like "A-{row}-{column}"',
  })
  position_format?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
