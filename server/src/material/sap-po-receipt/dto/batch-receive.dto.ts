import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

// batch-receive.dto.ts
export class BatchReceiveItemDto {
  @IsNotEmpty()
  @IsString()
  material: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  del_qty: number;

  @IsNotEmpty()
  @IsString()
  to_location_code: string;

  @IsOptional()
  @IsString()
  to_position_code?: string;

  @IsOptional()
  @IsString()
  lot_number?: string;
}

export class BatchReceiveDto {
  @IsNotEmpty()
  @IsString()
  create_by: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchReceiveItemDto)
  items: BatchReceiveItemDto[];
}
