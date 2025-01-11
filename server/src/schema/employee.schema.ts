import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Employee extends Document {
  @Prop({ default: null })
  EMP_ID: string;

  @Prop({ default: null })
  PriorName: string;

  @Prop({ default: null })
  FirstName: string;

  @Prop({ default: null })
  LastName: string;

  @Prop({ default: null })
  Section: string;

  @Prop({ default: null })
  Department: string;

  @Prop({ default: null })
  Position: string;

  @Prop({ default: null })
  Company_Code: string;

  @Prop({ default: null })
  ResignStatus: string;

  @Prop({ default: null })
  JobStart: string;

  @Prop({ default: null })
  FullName: string;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
