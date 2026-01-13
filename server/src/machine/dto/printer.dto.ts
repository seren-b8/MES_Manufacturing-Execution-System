// src/printer/dto/create-printer-device.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsIP,
  IsBoolean,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreatePrinterDeviceDto {
  @IsString()
  @IsNotEmpty()
  device_name: string;

  @IsString()
  @IsNotEmpty()
  @IsIP()
  ip_device: string;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'maintenance'])
  status?: string;

  @IsOptional()
  @IsEnum(['label', 'document', 'receipt', 'other'])
  printer_type?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsBoolean()
  @IsNotEmpty()
  is_socket: boolean;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePrinterDeviceDto extends PartialType(
  CreatePrinterDeviceDto,
) {}
