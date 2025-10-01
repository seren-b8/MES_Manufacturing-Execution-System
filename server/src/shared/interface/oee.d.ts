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

interface ShiftConfig {
  day: { start: number; end: number }; // 08:00 - 20:00
  night: { start: number; end: number }; // 20:00 - 08:00
}

export interface OEEQuery {
  date?: string; // e.g., '2025-09-30'
  shift?: 'day' | 'night';
  machine_numbers?: string[]; // หากต้องการระบุเครื่อง
}
