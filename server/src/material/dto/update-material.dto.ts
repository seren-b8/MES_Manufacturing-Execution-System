import { IsString, IsOptional } from 'class-validator';

export class UpdateMaterialDto {
  @IsString()
  @IsOptional()
  material_description?: string;
}
