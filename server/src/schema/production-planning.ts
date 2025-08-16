import { Prop, Schema } from '@nestjs/mongoose';
import { ProductionOrder } from './production-order.schema';
import { Types } from 'mongoose';
import { MasterPart } from './master_parts.schema';
import { User } from './user.schema';

@Schema({
  collection: 'production_planning',
  timestamps: true,
})
export class ProductionPlanning extends Document {
  // ข้อมูลพื้นฐาน
  @Prop({ required: true, index: true })
  machine_number: string;

  @Prop({ type: Date, required: true, index: true })
  planned_date: Date;

  @Prop({
    type: String,
    enum: ['sap_order', 'draft_plan'],
    required: true,
  })
  plan_type: string;

  // References
  @Prop({ type: Types.ObjectId, ref: ProductionOrder.name })
  production_order_id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: MasterPart.name })
  material_id?: Types.ObjectId;

  // ข้อมูลการวางแผนเท่านั้น
  @Prop({ required: true })
  total_order_quantity: number; // เป้าหมายรวม Order

  @Prop()
  planned_quantity?: number; // ยอดแผนนี้

  @Prop({ required: true })
  sequence_order: number;

  @Prop({ type: Date, required: true })
  planned_start_time: Date;

  @Prop({ type: Date, required: true })
  planned_end_time: Date;

  @Prop()
  estimated_hours?: number; // คำนวณจากข้อมูล master

  @Prop()
  man_power?: number; // **เก็บเพิ่ม**

  @Prop({
    type: String,
    enum: ['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'draft',
  })
  status: string;

  @Prop()
  setup_time?: number;

  @Prop()
  remark?: string;

  @Prop({ type: Types.ObjectId, ref: User.name })
  planned_by: Types.ObjectId;
}
