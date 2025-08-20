export class TimeFrameDto {
  machine_number: string;
  start_time: Date;
  end_time: Date;
  shift_type?: 'day' | 'night';
}

export class OEEResponseDto {
  machine_number: string;
  timeframe: TimeFrameDto;
  quality: number;
  availability: number;
  performance: number;
  oee: number;
  total_pieces: number;
  good_pieces: number;
}
