export interface TimeFrame {
  machine_number: string;
  start_time: Date;
  end_time: Date;
  shift_type?: 'day' | 'night';
}
