import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  collection: 'bom_items',
  timestamps: true,
  versionKey: false,
})
export class BOMItem extends Document {
  // ใช้ material_number ตรงๆ เพื่อ map กับ order
  @Prop({ required: true, index: true })
  order_id: string; // Order_ID จาก SAP

  @Prop({ required: true, index: true })
  parent_material_number: string; // Mat_No ของสินค้าหลัก

  @Prop({ required: true, index: true })
  component_material_number: string; // Component

  @Prop({ required: true })
  component_description: string; // ComponentDesc

  @Prop({ required: true, index: true })
  reservation: string; // Reservation

  @Prop({ required: true })
  required_quantity: number; // ReqQty per unit

  @Prop({ required: true })
  unit: string; // Unit_ReqQty

  @Prop()
  bom_item: string; // BOMItem

  @Prop()
  item_number: string; // ItemNo

  @Prop({ type: Date })
  log_date: Date;
}
export const BOMItemSchema = SchemaFactory.createForClass(BOMItem);
