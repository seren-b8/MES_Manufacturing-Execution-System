import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @Matches(/^(?!\s*$).+/, {
    message: 'Username cannot be empty or only whitespace',
  })
  employee_id: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @Matches(/^(?!\s*$).+/, {
    message: 'Password cannot be empty or only whitespace',
  })
  //   @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}
