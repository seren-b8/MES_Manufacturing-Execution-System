import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'log_assign_employee' })
export class LogAssignEmployee extends Document {
  @Prop({ default: null })
  employee_id: string;

  @Prop({ default: null })
  full_name: string;

  @Prop({ default: null })
  machine_number: string; // changed from machine_no

  @Prop({ default: null })
  work_center: string;

  @Prop({ default: null })
  order_number: string; // changed from order_no

  @Prop({ default: null })
  datetime_open_order: string;

  @Prop({ default: null })
  order_id: string;

  @Prop({ default: null })
  log_date: string;
}

export const LogAssignEmployeeSchema =
  SchemaFactory.createForClass(LogAssignEmployee);
