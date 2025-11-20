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

// Header DTO - เหลือเฉพาะที่จำเป็น
export class SAPPOHeaderDto {
  @IsNotEmpty()
  @IsString()
  invoice_no: string;

  @IsNotEmpty()
  @IsString()
  outbound: string;

  @IsNotEmpty()
  @IsDateString()
  del_date: string; // YYYY-MM-DD

  @IsNotEmpty()
  @IsString()
  create_by: string;
}

// Item DTO - เหลือเฉพาะที่จำเป็น
export class SAPPOItemDto {
  @IsNotEmpty()
  @IsString()
  po_doc: string;

  @IsNotEmpty()
  @IsString()
  material: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  del_qty: number;
}

// Main DTO
export class ReceiveFromSAPPODto {
  @ValidateNested()
  @Type(() => SAPPOHeaderDto)
  header: SAPPOHeaderDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SAPPOItemDto)
  items: SAPPOItemDto[];
}

// Query DTO (ไม่เปลี่ยน)
export class QuerySAPDODto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
