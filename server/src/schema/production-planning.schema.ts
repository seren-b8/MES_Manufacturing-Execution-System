import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ProductionOrder } from './production-order.schema';
import { Types } from 'mongoose';
import { MasterPart } from './master_parts.schema';
import { User } from './user.schema';
import { Document } from 'mongoose';

@Schema({
  collection: 'production_planning',
  timestamps: true,
  versionKey: false,
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

  @Prop()
  estimated_hours?: number; // คำนวณจากข้อมูล master

  @Prop({
    type: {
      day: { type: Number, default: 0 },
      night: { type: Number, default: 0 },
    },
  })
  man_power?: { day: number; night: number };

  @Prop({
    type: String,
    enum: ['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'draft',
  })
  status: string;

  @Prop()
  remark?: string;

  @Prop({ type: Types.ObjectId, ref: User.name })
  planned_by: Types.ObjectId;
}
export const ProductionPlanningSchema =
  SchemaFactory.createForClass(ProductionPlanning);
ProductionPlanningSchema.index({
  machine_number: 1,
  planned_date: 1,
  sequence_order: 1,
});
ProductionPlanningSchema.index({ production_order_id: 1 });
ProductionPlanningSchema.index({ material_id: 1 });
ProductionPlanningSchema.index({ status: 1 });
