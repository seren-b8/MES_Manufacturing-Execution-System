import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { deflate } from 'zlib';

export class CreateTempEmployeeDto {
  @IsNotEmpty()
  @IsString()
  employee_id: string;

  @IsNotEmpty()
  @IsString()
  prior_name: string;

  @IsNotEmpty()
  @IsString()
  first_name: string;

  @IsNotEmpty()
  @IsString()
  last_name: string;

  @IsNotEmpty()
  @IsString()
  section: string;

  @IsNotEmpty()
  @IsString()
  position: string;

  @IsNotEmpty()
  @IsString()
  company_code: string;

  @IsNotEmpty()
  @IsString()
  department: string;

  @IsNotEmpty()
  @IsString()
  resign_status: string;

  @IsNotEmpty()
  @IsString()
  job_start: string;
}
