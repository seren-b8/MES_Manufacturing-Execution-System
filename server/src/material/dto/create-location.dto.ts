// src/material/dto/create-location.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  Matches,
  MaxLength,
} from 'class-validator';

export enum LocationType {
  WAREHOUSE = 'warehouse',
  PRODUCTION = 'production',
  MACHINE = 'machine',
  SCRAP = 'scrap',
  QUARANTINE = 'quarantine',
  STAGING = 'staging',
}

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  location_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  location_code: string;

  @IsEnum(LocationType)
  location_type: LocationType;

  @IsOptional()
  @IsString()
  parent_location_id?: string;

  @IsBoolean()
  has_positions: boolean;

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
}
