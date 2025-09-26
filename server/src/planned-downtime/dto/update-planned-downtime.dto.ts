import { PartialType } from '@nestjs/mapped-types';
import { CreatePlannedDowntimeDto } from './create-planned-downtime.dto';
import { IsEnum, IsOptional } from 'class-validator';

// update-planned-downtime.dto.ts
export class UpdatePlannedDowntimeDto extends PartialType(
  CreatePlannedDowntimeDto,
) {
  @IsOptional()
  @IsEnum(['active', 'completed', 'cancelled'])
  status?: string;
}
