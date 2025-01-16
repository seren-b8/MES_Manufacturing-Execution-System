import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'employee' })
export class Employee extends Document {
  @Prop({ required: true, unique: true, index: true })
  employee_id: string;

  @Prop({ default: null })
  prior_name: string;

  @Prop({ default: null })
  first_name: string;

  @Prop({ default: null })
  last_name: string;

  @Prop({ default: null })
  section: string;

  @Prop({ index: true })
  department: string;

  @Prop({ default: null })
  position: string;

  @Prop({ default: null })
  company_code: string;

  @Prop({ default: null })
  resign_status: string;

  @Prop({ default: null })
  job_start: string;

  @Prop({ index: true })
  updated_at: Date;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
