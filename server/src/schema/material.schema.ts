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

  @Prop({
    type: [
      {
        location_id: { type: Types.ObjectId, ref: 'MaterialLocation' },
        position_id: { type: Types.ObjectId, ref: 'MaterialPosition' },
        stock_quantity: Number,
        lot_number: String,
      },
    ],
    default: [],
  })
  current_stock: Array<{
    location_id: Types.ObjectId;
    position_id?: Types.ObjectId;
    stock_quantity: number;
    lot_number?: string;
  }>;
}

export type MaterialDocument = Material & Document;
export const MaterialSchema = SchemaFactory.createForClass(Material);

MaterialSchema.index({ 'current_stock.location_id': 1 });
MaterialSchema.index({ 'current_stock.position_id': 1 });
