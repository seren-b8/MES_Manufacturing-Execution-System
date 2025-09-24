import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MaterialLocation } from './material-location.schema';

// สร้าง Embedded Document สำหรับ stock ในแต่ละ location
@Schema()
class CurrentStock {
  @Prop({ type: Types.ObjectId, ref: MaterialLocation.name, required: true })
  location_id: Types.ObjectId;

  @Prop({ required: true })
  stock_quantity: number;
}

const CurrentStockSchema = SchemaFactory.createForClass(CurrentStock);

// Material Schema หลัก
@Schema({ collection: 'material' })
export class Material {
  @Prop({ required: true })
  material_number: string;

  @Prop()
  material_description: string;

  @Prop({ required: true })
  unit_of_measurement: string;

  // ใช้ Array ของ CurrentStockSchema สำหรับการเก็บสต็อกในแต่ละ location
  @Prop({ type: [CurrentStockSchema] })
  current_stock: CurrentStock[];
}

export type MaterialDocument = Material & Document;
export const MaterialSchema = SchemaFactory.createForClass(Material);
