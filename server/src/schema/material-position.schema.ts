import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MaterialLocation } from './material-location.schema';
import { Material } from './material.schema';

// Material Position Schema หลัก
@Schema({
  collection: 'material_position',
  timestamps: true,
  versionKey: false,
})
export class MaterialPosition extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: MaterialLocation.name,
    required: true,
    index: true,
  })
  location_id: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
    unique: false, // จะสร้าง compound unique index แทน
  })
  position_code: string; // A-1, A-2, B-1

  @Prop()
  shelf_code?: string; // A, B, C

  @Prop()
  row?: string; // 1, 2, 3

  @Prop()
  column?: string; // 1, 2, 3

  @Prop({ default: false })
  is_occupied: boolean;

  @Prop({ min: 0 })
  max_capacity?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export type MaterialPositionDocument = MaterialPosition & Document;
export const MaterialPositionSchema =
  SchemaFactory.createForClass(MaterialPosition);

// Indexes
MaterialPositionSchema.index(
  {
    location_id: 1,
    position_code: 1,
  },
  {
    unique: true,
    name: 'location_position_unique',
  },
);

MaterialPositionSchema.index(
  {
    location_id: 1,
    is_occupied: 1,
  },
  {
    name: 'location_occupied_index',
  },
);

MaterialPositionSchema.index(
  {
    shelf_code: 1,
    row: 1,
    column: 1,
  },
  {
    name: 'position_layout_index',
  },
);
