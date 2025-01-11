// src/schemas/assign-emp.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class AssignEmp extends Document {
  @Prop({ default: null })
  EMP_ID: string;

  @Prop({ default: null })
  FullName: string;

  @Prop({ default: null })
  MC_No: string;

  @Prop({ default: null })
  WorkCenter: string;

  @Prop({ default: null })
  Order_ID: string;

  @Prop({ default: null })
  DatetimeOpenOrder: string;

  @Prop({ default: null })
  _idOrder: string;

  @Prop({ default: null })
  Logdate: string;
}

export const AssignEmpSchema = SchemaFactory.createForClass(AssignEmp);
