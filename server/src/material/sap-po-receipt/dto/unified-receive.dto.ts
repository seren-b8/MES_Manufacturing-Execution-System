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

// unified-receive.dto.ts
export class UnifiedReceiveItemDto {
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

  @IsOptional()
  @IsString()
  po_doc?: string; // Required only for sap_sync mode
}

export class UnifiedReceiveHeaderDto {
  @IsNotEmpty()
  @IsString()
  create_by: string;

  @IsOptional()
  @IsString()
  invoice_no?: string; // Required only for sap_sync

  @IsOptional()
  @IsString()
  outbound?: string; // Required only for sap_sync

  @IsOptional()
  @IsDateString()
  del_date?: string; // Required only for sap_sync
}

export class UnifiedReceiveDto {
  @IsNotEmpty()
  @IsString()
  mode: 'receive_only' | 'sap_sync';

  @ValidateNested()
  @Type(() => UnifiedReceiveHeaderDto)
  header: UnifiedReceiveHeaderDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UnifiedReceiveItemDto)
  items: UnifiedReceiveItemDto[];
}
