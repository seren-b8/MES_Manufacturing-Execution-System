export interface Employee {
  prior_name?: string;
  first_name: string;
  last_name: string;
  employee_id: string;
}

export interface User {
  employee_id: string;
  role: string;
  user_id: string;
}

export interface UserWithEmployeeData extends User {
  prior_name?: string;
  first_name?: string;
  last_name?: string;
}
