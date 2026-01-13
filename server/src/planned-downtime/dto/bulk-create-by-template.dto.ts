import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreatePlannedDowntimeDto } from './create-planned-downtime.dto';

// bulk-create-by-template.dto.ts
export class BulkCreateByTemplateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePlannedDowntimeDto)
  downtimes: CreatePlannedDowntimeDto[];
}
