import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateMachineInfoDto {
  @IsString()
  @IsNotEmpty({ message: 'Machine number is required' })
  machine_number: string;

  @IsString()
  @IsNotEmpty({ message: 'Machine name is required' })
  machine_name: string;

  @IsString()
  @IsNotEmpty({ message: 'Work center is required' })
  work_center: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Tonnage is required' })
  tonnage: number;

  @IsString()
  @IsNotEmpty({ message: 'Line is required' })
  line: string;
}
