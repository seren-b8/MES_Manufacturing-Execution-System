// dto/purchasing-document.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ==================== ENUMS ====================

export enum PurchasingDocumentStatus {
  OPEN = 'open',
  PARTIAL = 'partial',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

// ==================== QUERY DTOs ====================

/**
 * DTO สำหรับ Query/Filter PO documents
 * GET /purchasing-documents
 */
export class QueryPurchasingDocumentDto {
  @IsOptional()
  @IsString()
  plant?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsString()
  purchasing_document?: string;

  @IsOptional()
  @IsEnum(PurchasingDocumentStatus)
  status?: PurchasingDocumentStatus;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean) // Transform string to boolean
  sap_active?: boolean;

  @IsOptional()
  @IsDateString()
  doc_date_from?: string;

  @IsOptional()
  @IsDateString()
  doc_date_to?: string;

  @IsOptional()
  @IsDateString()
  sap_last_sync_from?: string;

  @IsOptional()
  @IsDateString()
  sap_last_sync_to?: string;

  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Sorting
  @IsOptional()
  @IsString()
  sort?: string = '-createdAt'; // Default: newest first

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;
}

// ==================== SYNC DTOs ====================

/**
 * DTO สำหรับ Manual Sync ด้วย parameters
 * POST /purchasing-documents/sync
 */
export class SyncPurchasingDocumentDto {
  @IsNotEmpty()
  @IsString()
  plant: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * DTO สำหรับ Sync Single PO
 * POST /purchasing-documents/sync/:po_number
 */
export class SyncSinglePODto {
  @IsNotEmpty()
  @IsString()
  plant: string;
}

/**
 * DTO สำหรับ Sync by Plant
 * POST /purchasing-documents/sync/plant/:plant
 */
export class SyncByPlantDto {
  // ไม่ต้องมี fields เพราะ plant มาจาก @Param
  // แต่อาจเพิ่ม options ได้

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  mark_inactive?: boolean = true; // Mark PO ที่ไม่มีใน SAP
}

// ==================== STATISTICS DTOs ====================

/**
 * DTO สำหรับ Query Status Stats
 * GET /purchasing-documents/stats/status
 */
export class StatusStatsQueryDto {
  @IsOptional()
  @IsString()
  plant?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

/**
 * DTO สำหรับ Query Sync Stats
 * GET /purchasing-documents/stats/sync
 */
export class SyncStatsQueryDto {
  @IsOptional()
  @IsString()
  plant?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  include_inactive?: boolean = false;
}

// ==================== RESPONSE DTOs ====================

/**
 * Standard Response Format
 */
export class PurchasingDocumentResponseDto<T> {
  status: 'success' | 'error';
  message: string;
  data: T[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Sync Result Response
 */
export class SyncResultDto {
  plant?: string;
  synced: number;
  failed: number;
  totalSynced?: number;
  errors?: any[];
}
