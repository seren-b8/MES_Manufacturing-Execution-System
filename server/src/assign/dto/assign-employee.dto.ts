import { IsMongoId, IsNotEmpty } from 'class-validator';

export class CreateAssignEmployeeDto {
  @IsMongoId() // เพิ่ม validation ว่าเป็น MongoDB ID ที่ถูกต้อง
  @IsNotEmpty()
  user_id: string;

  @IsMongoId()
  @IsNotEmpty()
  assign_order_id: string;
}

export class UpdateAssignEmployeeDto {
  status?: 'active' | 'completed' | 'suspended';
}

export interface AssignOrder {
  _id: string;
  status: string;
}

export class CloseByUserDto {
  @IsMongoId()
  @IsNotEmpty()
  user_id: string;

  @IsMongoId()
  @IsNotEmpty()
  assign_order_id: string;
}

// Interfaces
export interface AssignEmployee {
  user_id: string;
  work_center: string;
  assign_order_id: string;
  status: 'active' | 'completed' | 'suspended';
  log_date: Date;
}

export interface User {
  _id: string;
  employee_id: string;
  role: string;
}
