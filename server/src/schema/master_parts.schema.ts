import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ collection: 'master_parts', timestamps: true, versionKey: false })
export class MasterPart extends Document {
  @Prop({ required: true, unique: true })
  material_number: string;

  @Prop()
  material_description: string;

  @Prop()
  part_number: string;

  @Prop()
  part_name: string;

  @Prop()
  weight: number;

  @Prop()
  part_model: string;

  @Prop()
  image_url: string;

  @Prop({ type: String })
  co_product_material?: string; // material_number ของงานคู่

  @Prop({ default: false })
  is_co_product: boolean;
}

export const MasterPartSchema = SchemaFactory.createForClass(MasterPart);

MasterPartSchema.index({ is_co_product: 1 });
MasterPartSchema.index({ co_product_material: 1 });
