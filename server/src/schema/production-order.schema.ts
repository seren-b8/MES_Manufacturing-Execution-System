import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'production_order', timestamps: true, versionKey: false })
export class ProductionOrder extends Document {
  @Prop({ default: null })
  plant: string;

  @Prop({ default: null })
  order_id: string;

  @Prop({ default: null })
  material_number: string; // changed from Mat_No

  @Prop({ default: null })
  material_description: string; // changed from MatDesc

  @Prop({ type: Date, default: null }) // เปลี่ยนเป็น Date
  basic_start_date: Date;

  @Prop({ type: Date, default: null }) // เปลี่ยนเป็น Date
  basic_finish_date: Date;

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

  @Prop({ type: Date, default: null }) // เปลี่ยนเป็น Date
  log_date: Date;

  @Prop({ default: null })
  condition_amount: number;

  @Prop({ default: false, type: Boolean })
  assign_stage: boolean;

  createdAt?: Date; // จาก timestamps: true

  updateAt?: Date; // จาก timestamps: true

  // ฟิลด์ใหม่สำหรับติดตามสถานะใน SQL
  @Prop({ default: true })
  sql_active: boolean;

  // วันเวลาที่ sync กับ SQL ล่าสุด
  @Prop({ type: Date, default: Date.now })
  sql_last_sync: Date;

  // วันเวลาที่ตรวจพบว่าไม่มีใน SQL แล้ว
  @Prop({ type: Date })
  sql_inactive_date: Date;
}

export const ProductionOrderSchema =
  SchemaFactory.createForClass(ProductionOrder);

// เพิ่ม Index เพื่อช่วยในการค้นหา
ProductionOrderSchema.index({ order_id: 1, work_center: 1 }, { unique: true });
ProductionOrderSchema.index({ sql_active: 1 });
ProductionOrderSchema.index({ sql_inactive_date: -1 });
ProductionOrderSchema.index({ assign_stage: 1, sql_active: 1 });

ProductionOrderSchema.index({
  material_number: 1,
}); // สำหรับ filter material_number

ProductionOrderSchema.index({
  material_description: 'text',
}); // สำหรับ search
