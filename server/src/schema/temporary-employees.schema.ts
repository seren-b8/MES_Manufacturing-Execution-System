import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'temporary_employee' })
export class TemporaryEmployee extends Document {
  @Prop({ default: null })
  employee_id: string; // changed from EMP_ID

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
  job_start_date: string; // changed from JobStart for clarity
}

export const TemporaryEmployeeSchema =
  SchemaFactory.createForClass(TemporaryEmployee);
