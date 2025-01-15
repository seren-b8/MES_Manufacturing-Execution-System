export interface TLoginResponse {
  employee_id: string;
  role: string;
  full_name: string;
  position: string;
  token: string;
}

export interface TUser extends Document {
  employee_id: string;
  password: string;
  role: string;
}

export interface TEmployee extends Document {
  employee_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

export interface TTemporaryEmployee extends TEmployee {}

export interface TLoginDto {
  employee_id: string;
  password: string;
}
