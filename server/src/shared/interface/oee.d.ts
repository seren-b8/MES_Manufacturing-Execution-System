export interface TimeFrame {
  machine_numbers: string[];
  start_time: Date;
  end_time: Date;
  shift_type?: 'day' | 'night';
}

export interface ProcessedMachineData {
  machineNumber: string;
  quality: number;
  assignOrderIds: string[];
}
