export class CreateAssignEmployeeDto {
  user_id: string;
  assign_order_id: string;
}

export class UpdateAssignEmployeeDto {
  status?: 'active' | 'completed' | 'suspended';
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

export interface AssignOrder {
  _id: string;
  status: string;
}

export class CloseByUserDto {
  user_id: string;
  assign_order_id: string;
}
