import { IsOptional, IsString, IsNumber } from 'class-validator';

export class QueryAssignEmployeeDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  work_center?: string;

  @IsOptional()
  @IsString()
  machine_number?: string;

  @IsOptional()
  @IsString()
  employee_id?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  skip?: number;
}
