// src/schema/oee-daily.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'oee_daily',
  timestamps: true,
  versionKey: false,
})
export class OEEDaily extends Document {
  @Prop({ required: true, index: true })
  machine_number: string;

  @Prop({ required: true, index: true })
  date: Date; // วันที่ production date

  @Prop({ required: true })
  oee: number;

  @Prop({ required: true })
  quality: number;

  @Prop({ required: true })
  availability: number;

  @Prop({ required: true })
  performance: number;

  // Aggregated data from hourly records
  @Prop({
    type: {
      day_shift: {
        oee: Number,
        quality: Number,
        availability: Number,
        performance: Number,
      },
      night_shift: {
        oee: Number,
        quality: Number,
        availability: Number,
        performance: Number,
      },
    },
  })
  shift_breakdown?: {
    day_shift: {
      oee: number;
      quality: number;
      availability: number;
      performance: number;
    };
    night_shift: {
      oee: number;
      quality: number;
      availability: number;
      performance: number;
    };
  };

  @Prop({ type: [String], default: [] })
  data_warnings?: string[]; // ['no_production_records', 'performance_over_150_percent']

  @Prop({ default: false })
  has_incomplete_data: boolean; // มีข้อมูลไม่ครบ

  @Prop()
  incomplete_reason?: string; // 'Missing quality data', 'Only night shift data'

  // ฟิลด์สำหรับ Statistics
  @Prop({
    type: {
      day_shift_hours: Number, // จำนวนชั่วโมงที่มีข้อมูล
      night_shift_hours: Number,
      total_hours: Number,
    },
  })
  hours_summary?: {
    day_shift_hours: number;
    night_shift_hours: number;
    total_hours: number;
  };

  // ฟิลด์สำหรับ Raw Data
  @Prop({
    type: {
      total_good_pieces: Number,
      total_not_good_pieces: Number,
      total_pieces: Number,
      total_on_time: Number, // seconds
      total_actual_shots: Number,
      total_theoretical_shots: Number,
    },
  })
  raw_totals?: {
    total_good_pieces: number;
    total_not_good_pieces: number;
    total_pieces: number;
    total_on_time: number;
    total_actual_shots: number;
    total_theoretical_shots: number;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

export const OEEDailySchema = SchemaFactory.createForClass(OEEDaily);

// Indexes
OEEDailySchema.index({ machine_number: 1, date: 1 }, { unique: true });
OEEDailySchema.index({ date: -1 });
// Index เพิ่มเติม
OEEDailySchema.index({ machine_number: 1, date: -1 }); // สำหรับดูย้อนหลัง
OEEDailySchema.index({ has_incomplete_data: 1 }); // สำหรับกรองข้อมูลไม่ครบ
OEEDailySchema.index({ data_warnings: 1 }); // สำหรับหา records ที่มี warning
