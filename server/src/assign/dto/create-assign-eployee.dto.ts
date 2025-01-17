import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';

export class CreateAssignEmployeeDto {
  @IsNotEmpty()
  @IsString()
  employee_id: string;

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
}
