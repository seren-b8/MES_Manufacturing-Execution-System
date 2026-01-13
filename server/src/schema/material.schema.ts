import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MaterialLocation } from './material-location.schema';
import { MaterialPosition } from './material-position.schema';

// สร้าง Embedded Document สำหรับ stock ในแต่ละ location

// Material Schema หลัก
@Schema({ collection: 'material', timestamps: true, versionKey: false })
export class Material {
  @Prop({ required: true })
  material_number: string;

  @Prop()
  material_description: string;

  @Prop({ required: true })
  unit_of_measurement: string;

  // เม็ดนี้ถูกใช้ในสินค้า FG อะไรบ้าง (Default)
  @Prop({
    type: {
      used_in_products: [String], // FG material numbers ที่ใช้เม็ดนี้
      last_updated: Date,
      is_active: { type: Boolean, default: true },
    },
    default: null,
  })
  default_usage?: {
    used_in_products: string[]; // FG material numbers
    last_updated: Date;
    is_active: boolean;
  };

  // เม็ดนี้ถูกใช้ใน Order ไหนบ้าง (เฉพาะ Order)
  @Prop({
    type: [
      {
        order_id: { type: String, required: true },
        used_in_products: [String], // FG material numbers
        log_date: Date,
        is_active: { type: Boolean, default: true },
      },
    ],
    default: [],
  })
  usage_by_orders: Array<{
    order_id: string;
    used_in_products: string[]; // FG material numbers
    log_date?: Date;
    is_active: boolean;
  }>;

  @Prop({
    type: [
      {
        location_id: { type: Types.ObjectId, ref: 'MaterialLocation' },
        position_id: { type: Types.ObjectId, ref: 'MaterialPosition' },
        stock_quantity: Number,
        lot_number: String,
        last_updated: { type: Date, default: Date.now }, // เพิ่มฟิลด์นี้
      },
    ],
    default: [],
  })
  current_stock: Array<{
    location_id: Types.ObjectId;
    position_id?: Types.ObjectId;
    stock_quantity: number;
    lot_number?: string;
    last_updated: Date;
  }>;
}

export type MaterialDocument = Material & Document;
export const MaterialSchema = SchemaFactory.createForClass(Material);

MaterialSchema.index({ 'current_stock.location_id': 1 });
MaterialSchema.index({ 'current_stock.position_id': 1 });
MaterialSchema.index({ material_number: 1 });
MaterialSchema.index({ 'bom_by_orders.order_id': 1 });
MaterialSchema.index({ 'default_bom.components': 1 });
MaterialSchema.index({ 'bom_by_orders.components': 1 });
