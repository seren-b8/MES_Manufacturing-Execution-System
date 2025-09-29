import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// --- Nested Schemas for Clarity ---

// Schema for raw Quality data
class QualityPiecesData {
  @Prop({ required: true })
  good_pieces: number;

  @Prop({ required: true })
  not_good_pieces: number;

  @Prop({ required: true })
  total_pieces: number;
}

// Schema for raw Availability data
class AvailabilityData {
  @Prop({ required: true })
  total_on_time: number; // e.g., in seconds

  @Prop({ required: true })
  total_off_time: number; // e.g., in seconds

  @Prop({ required: true })
  total_alarm_time: number; // e.g., in seconds

  @Prop({ required: true })
  total_time: number; // e.g., in seconds

  @Prop({ required: true })
  planned_downtime: number;
}

// Schema for raw Performance data
class PerformanceData {
  @Prop({ required: true })
  actual_shots: number;

  @Prop({ required: true })
  theoretical_shots: number;

  @Prop({ required: true })
  target_cycle_time: number; // e.g., in seconds

  @Prop({ required: true })
  timeframe_duration_seconds: number;
}

// --- Main Schema ---

@Schema({
  collection: 'oee_hourly',
  timestamps: true,
  versionKey: false,
})
export class OEEHourly extends Document {
  @Prop({ required: true, index: true })
  machine_number: string; // Matches 'machineNumber' key

  // --- Timeframe Fields ---
  @Prop({ required: true, index: true })
  start_time: Date; // Matches 'startTime' key

  @Prop({ required: true })
  end_time: Date; // Matches 'endTime' key

  @Prop({
    required: true,
    enum: ['day', 'night'],
    index: true,
  })
  shift: 'day' | 'night'; // Matches 'shift' key

  // --- OEE Metrics ---
  @Prop({ required: true })
  oee: number;

  @Prop({ required: true })
  quality: number;

  @Prop({ required: true })
  availability: number;

  @Prop({ required: true })
  performance: number;

  // --- Raw Data ---
  @Prop({ type: QualityPiecesData, required: false })
  quality_pieces_data?: QualityPiecesData; // Optional, as it's conditionally included

  @Prop({ type: AvailabilityData, required: false })
  availability_data?: AvailabilityData; // Optional, as it's conditionally included

  @Prop({ type: PerformanceData, required: false })
  performance_data?: PerformanceData; // Optional, as it's conditionally included
}

export const OEEHourlySchema = SchemaFactory.createForClass(OEEHourly);

OEEHourlySchema.index(
  {
    machine_number: 1,
    start_time: 1,
    end_time: 1,
    shift: 1,
  },
  {
    unique: true,
    name: 'unique_timeframe_per_machine',
  },
);
// --- Indexes ---
// Compound index (Machine + Time)
OEEHourlySchema.index({ machineNumber: 1, startTime: -1 });

// Shift-based index
OEEHourlySchema.index({ shift: 1, startTime: 1 });

// TTL index (30 days - adjusted to use startTime, which is the timeframe start)
OEEHourlySchema.index(
  { startTime: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);
