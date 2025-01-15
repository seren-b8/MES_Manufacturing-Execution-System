import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';

export class CreateAssignEmployeeDto {
  @IsNotEmpty()
  @IsString()
  employee_id: string;

  @IsNotEmpty()
  @IsString()
  full_name: string;

  @IsNotEmpty()
  @IsString()
  machine_number: string;

  @IsNotEmpty()
  @IsString()
  work_center: string;

  @IsNotEmpty()
  @IsString()
  assign_order_id: string;

  @IsNotEmpty()
  @IsString()
  order_id: string;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsObject()
  assignment_details?: {
    position?: string;
    supervisor_id?: string;
    notes?: string;
    replacement_for?: string;
  };
}
