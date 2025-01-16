import { IsNotEmpty, IsString } from 'class-validator';

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
  jobs_start_date: string;
}
