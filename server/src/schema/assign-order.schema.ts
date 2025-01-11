import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class AssignOrder extends Document {
  @Prop({ default: null })
  Plant: string;

  @Prop({ default: null })
  Order_ID: string;

  @Prop({ default: null })
  Mat_No: string;

  @Prop({ default: null })
  MatDesc: string;

  @Prop({ default: null })
  BS_StartDate: string;

  @Prop({ default: null })
  BS_FinishDate: string;

  @Prop({ default: null })
  TargetQty: number;

  @Prop({ default: null })
  Unit: string;

  @Prop({ default: null })
  ScrapQty: number;

  @Prop({ default: null })
  MRP_Controller: string;

  @Prop({ default: null })
  MRP_Name: string;

  @Prop({ default: null })
  ProdSup: string;

  @Prop({ default: null })
  GrpRounting: string;

  @Prop({ default: null })
  Opt_task_list_no: string;

  @Prop({ default: null })
  CounterNo: string;

  @Prop({ default: null })
  SequenceNo: string;

  @Prop({ default: null })
  TaskListNode: string;

  @Prop({ default: null })
  GrpCounter: string;

  @Prop({ default: null })
  Activity: string;

  @Prop({ default: null })
  OptShortText: string;

  @Prop({ default: null })
  ObjectID: string;

  @Prop({ default: null })
  WorkCenter: string;

  @Prop({ default: null })
  SetTime1: string;

  @Prop({ default: null })
  SetTime2: string;

  @Prop({ default: null })
  SetTime3: string;

  @Prop({ default: null })
  Lot: number;

  @Prop({ default: null })
  PlanCT: number;

  @Prop({ default: null })
  PlanActualTime: number;

  @Prop({ default: null })
  PlanTargetDay: number;

  @Prop({ default: null })
  MC_No: string;

  @Prop({ default: null })
  LINE: string;

  @Prop({ default: null })
  cavity: string;

  @Prop({ default: null })
  weight: string;

  @Prop({ default: null })
  runner: string;

  @Prop({ default: null })
  cycle_time: string;

  @Prop({ default: null })
  ConditionAmount: number;

  @Prop({ default: null })
  DatetimeOpenOrder: string;
}

export const AssignOrderSchema = SchemaFactory.createForClass(AssignOrder);
