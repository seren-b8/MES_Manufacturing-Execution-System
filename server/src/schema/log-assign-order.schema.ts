import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'log_assign_order' })
export class LogAssignOrder extends Document {
  @Prop({ default: null })
  plant: string;

  @Prop({ default: null })
  employee_name: string;

  @Prop({ default: null })
  actual_finished_goods: number; // changed from actual_fg

  @Prop({ default: null })
  difference: number; // changed from diff

  @Prop({ default: null })
  ng_quantity: number;

  @Prop({ default: null })
  data_not_good: string; // changed from data_ng

  @Prop({ default: null })
  order_id: string;

  @Prop({ default: null })
  material_number: string; // changed from mat_no

  @Prop({ default: null })
  material_description: string; // changed from mat_desc

  @Prop({ default: null })
  basic_start_date: string; // changed from BS_StartDate

  @Prop({ default: null })
  basic_finish_date: string; // changed from BS_FinishDate

  @Prop({ default: null })
  target_quantity: number; // changed from TargetQty

  @Prop({ default: null })
  unit: string; // changed from Unit

  @Prop({ default: null })
  mrp_controller: string; // changed from MRP_Controller

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
  task_list_node: string; // changed from TaskListNode

  @Prop({ default: null })
  group_counter: string; // changed from GrpCounter

  @Prop({ default: null })
  activity: string;

  @Prop({ default: null })
  operation_short_text: string; // changed from OptShortText

  @Prop({ default: null })
  object_id: string; // changed from ObjectID

  @Prop({ default: null })
  work_center: string; // changed from WorkCenter

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
  plan_actual_time: number; // changed from PlanActualTime

  @Prop({ default: null })
  plan_target_day: number; // changed from PlanTargetDay

  @Prop({ default: null })
  machine_number: string; // changed from MC_No

  @Prop({ default: null })
  line: string; // changed from LINE

  @Prop({ default: null })
  cavity: string;

  @Prop({ default: null })
  weight: string;

  @Prop({ default: null })
  runner: string;

  @Prop({ default: null })
  cycle_time: string;

  @Prop({ default: null })
  condition_amount: string; // changed from ConditionAmount

  @Prop({ default: null })
  datetime_open_order: string; // changed from DatetimeOpenOrder

  @Prop({ default: null })
  datetime_close_jobs: string; // changed from DTCloseJobs

  @Prop({ default: null })
  balance: number; // changed from Balance

  @Prop({ default: null })
  send_to_sap: string; // changed from sendSAP

  @Prop({ default: null })
  log_date_sap: string; // changed from LogDateSAP

  @Prop({ default: null })
  order_id_ref: string; // changed from _idOrder
}

export const LogAssignOrderSchema =
  SchemaFactory.createForClass(LogAssignOrder);
