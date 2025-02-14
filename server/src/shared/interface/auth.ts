export interface TLoginResponse {
  user_id: string;
  employee_id: string;
  role: string;
  full_name: string;
  position: string;
  token: string;
  external_auth: boolean;
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

export interface JwtPayload {
  sub: string; // user id จาก MongoDB
  employee_id: string; // รหัสพนักงาน
  role: string; // สิทธิ์การใช้งาน
  iat?: number; // issued at timestamp
  exp?: number; // expiration timestamp
}
