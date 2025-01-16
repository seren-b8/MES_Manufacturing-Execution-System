export class UpdateRoleDto {
  employee_id: string;
  role: 'admin' | 'user' | 'block';
}
