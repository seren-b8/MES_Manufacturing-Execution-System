export class CreateUserDto {
  employee_id: string;
  role: 'admin' | 'user' | 'block';
  // external_auth: boolean;
  // password: string;
}
