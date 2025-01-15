import { PartialType } from '@nestjs/mapped-types';
import { CreateAssignEmployeeDto } from './create-assign-eployee.dto';

export class UpdateAssignEmployeeDto extends PartialType(
  CreateAssignEmployeeDto,
) {}
