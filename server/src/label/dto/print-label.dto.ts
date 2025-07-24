import { IsString } from 'class-validator';
import { machine } from 'os';

export class PrintLabelDto {
  @IsString()
  job_id: string;

  @IsString()
  machine_number: string;
}
