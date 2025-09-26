// src/material/dto/position-code.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class GeneratePositionCodeDto {
  @IsString()
  @IsNotEmpty()
  location_id: string;

  @IsString()
  @IsNotEmpty()
  row: string;

  @IsString()
  @IsNotEmpty()
  column: string;
}
