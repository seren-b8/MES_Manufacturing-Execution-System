import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { toObjectId } from 'src/shared/utils/type.utils';

@Schema({
  collection: 'material_location',
  timestamps: true,
  versionKey: false,
})
export class MaterialLocation extends Document {
  @Prop({
    required: true,
    trim: true,
    index: true,
  })
  location_name: string;

  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  })
  location_code: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'MaterialLocation',
    default: null,
  })
  parent_location_id?: Types.ObjectId; // สำหรับ hierarchy

  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  has_positions: boolean; // มี position หรือไม่

  @Prop({
    type: String,
    maxlength: 500,
  })
  description?: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  is_active: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export type MaterialLocationDocument = MaterialLocation & Document;
export const MaterialLocationSchema =
  SchemaFactory.createForClass(MaterialLocation);

// Indexes
MaterialLocationSchema.index(
  {
    location_type: 1,
    is_active: 1,
  },
  {
    name: 'type_active_index',
  },
);

MaterialLocationSchema.index(
  {
    parent_location_id: 1,
  },
  {
    name: 'parent_hierarchy_index',
  },
);

MaterialLocationSchema.index(
  {
    has_positions: 1,
    location_type: 1,
  },
  {
    name: 'positions_type_index',
  },
);

// Virtual สำหรับ child locations
MaterialLocationSchema.virtual('child_locations', {
  ref: 'MaterialLocation',
  localField: '_id',
  foreignField: 'parent_location_id',
});

// Virtual สำหรับ positions
MaterialLocationSchema.virtual('positions', {
  ref: 'MaterialPosition',
  localField: '_id',
  foreignField: 'location_id',
});

// Method สำหรับ generate position code
MaterialLocationSchema.methods.generatePositionCode = function (
  row: string,
  column: string,
): string {
  if (!this.position_format) {
    throw new Error('Position format not defined for this location');
  }

  return this.position_format.replace('{row}', row).replace('{column}', column);
};

// Static method สำหรับหา warehouse locations
MaterialLocationSchema.statics.findWarehouses = function () {
  return this.find({
    location_type: 'warehouse',
    is_active: true,
  });
};

// Static method สำหรับหา locations ที่มี positions
MaterialLocationSchema.statics.findWithPositions = function () {
  return this.find({
    has_positions: true,
    is_active: true,
  });
};

// Pre-remove middleware
MaterialLocationSchema.pre(
  'deleteOne',
  { document: true, query: false },
  async function (next) {
    // Check if location has child locations
    const childCount = await (this.constructor as any).countDocuments({
      parent_location_id: this._id,
    });

    if (childCount > 0) {
      next(new Error('Cannot delete location with child locations'));
      return;
    }

    // Check if location has positions
    const positionCount = await this.db
      .collection('material_position')
      .countDocuments({
        location_id: this._id,
      });

    if (positionCount > 0) {
      next(new Error('Cannot delete location with existing positions'));
      return;
    }

    next();
  },
);
