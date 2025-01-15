import { IsString, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  employee_id: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  password?: string;
}
