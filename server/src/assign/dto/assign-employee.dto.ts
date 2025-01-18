export class CreateAssignEmployeeDto {
  user_id: string;
  assign_order_id: string;
}

export class UpdateAssignEmployeeDto {
  status?: 'active' | 'completed' | 'suspended';
}

// Interfaces
interface AssignEmployee {
  user_id: string;
  work_center: string;
  assign_order_id: string;
  status: 'active' | 'completed' | 'suspended';
  log_date: Date;
}

interface User {
  _id: string;
  employee_id: string;
  role: string;
}

interface AssignOrder {
  _id: string;
  status: string;
}
