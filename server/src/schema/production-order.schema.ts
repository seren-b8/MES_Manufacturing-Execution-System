import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'production_order' })
export class ProductionOrder extends Document {
  @Prop({ default: null })
  plant: string;

  @Prop({ default: null })
  order_id: string;

  @Prop({ default: null })
  material_number: string; // changed from Mat_No

  @Prop({ default: null })
  material_description: string; // changed from MatDesc

  @Prop({ default: null })
  basic_start_date: string; // changed from BS_StartDate

  @Prop({ default: null })
  basic_finish_date: string; // changed from BS_FinishDate

  @Prop({ default: null })
  target_quantity: number; // changed from TargetQty

  @Prop({ default: null })
  unit: string;

  @Prop({ default: null })
  scrap_quantity: number; // changed from ScrapQty

  @Prop({ default: null })
  mrp_controller: string;

  @Prop({ default: null })
  mrp_controller_name: string; // changed from MRP_Name

  @Prop({ default: null })
  production_supervisor: string; // changed from ProdSup

  @Prop({ default: null })
  group_routing: string; // changed from GrpRounting

  @Prop({ default: null })
  operation_task_list_number: string; // changed from Opt_task_list_no

  @Prop({ default: null })
  counter_number: string; // changed from CounterNo

  @Prop({ default: null })
  sequence_number: string; // changed from SequenceNo

  @Prop({ default: null })
  task_list_node: string;

  @Prop({ default: null })
  group_counter: string; // changed from GrpCounter

  @Prop({ default: null })
  activity: string;

  @Prop({ default: null })
  operation_short_text: string; // changed from OptShortText

  @Prop({ default: null })
  object_id: string;

  @Prop({ default: null })
  work_center: string;

  @Prop({ default: null })
  setup_time_1: string; // changed from SetTime1

  @Prop({ default: null })
  setup_time_2: string; // changed from SetTime2

  @Prop({ default: null })
  setup_time_3: string; // changed from SetTime3

  @Prop({ default: null })
  lot: number;

  @Prop({ default: null })
  plan_cycle_time: number; // changed from PlanCT

  @Prop({ default: null })
  plan_actual_time: number;

  @Prop({ default: null })
  plan_target_day: number;

  @Prop({ default: null })
  show_job: number;

  @Prop({ default: null })
  log_date: string;

  @Prop({ default: null })
  condition_amount: number;

  @Prop({ default: false, type: Boolean })
  assign_stage: boolean;
}

export const ProductionOrderSchema =
  SchemaFactory.createForClass(ProductionOrder);
