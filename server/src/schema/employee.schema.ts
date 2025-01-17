import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'employee' })
export class Employee extends Document {
  @Prop({ required: true, unique: true, index: true })
  employee_id: string;

  @Prop({ type: String, default: null })
  prior_name: string;

  @Prop({ type: String, default: null })
  first_name: string;

  @Prop({ type: String, default: null })
  last_name: string;

  @Prop({ type: String, default: null })
  section: string;

  @Prop({ type: String, index: true })
  department: string;

  @Prop({ type: String, default: null })
  position: string;

  @Prop({ type: String, default: null })
  company_code: string;

  @Prop({ type: String, default: null })
  resign_status: string;

  @Prop({ type: String, default: null })
  job_start: string;

  @Prop({ type: String, default: 'false' })
  is_temporary: string;

  @Prop({ type: Date, index: true })
  updated_at: Date;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
