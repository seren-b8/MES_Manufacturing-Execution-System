import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'employee' })
export class Employee extends Document {
  @Prop({ default: null })
  employee_id: string;

  @Prop({ default: null })
  prior_name: string;

  @Prop({ default: null })
  first_name: string;

  @Prop({ default: null })
  last_name: string;

  @Prop({ default: null })
  section: string;

  @Prop({ default: null })
  department: string;

  @Prop({ default: null })
  position: string;

  @Prop({ default: null })
  company_code: string;

  @Prop({ default: null })
  resign_status: string;

  @Prop({ default: null })
  job_start: string;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
