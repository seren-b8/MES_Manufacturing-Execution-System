import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'material_location' })
export class MaterialLocation {
  @Prop({ required: true })
  location_name: string;

  @Prop({ required: true, unique: true })
  location_code: string;

  @Prop()
  location_type: string;
}

export type LocationDocument = MaterialLocation & Document;
export const LocationSchema = SchemaFactory.createForClass(MaterialLocation);
