export interface MachineInfo {
  work_center: string;
  machine_number: string;
  status: string;
  counter: number;
  cycle_time: number;
}

export interface ProductionOrder {
  _id: Types.ObjectId;
  order_id: string;
  material_number: string;
  material_description: string;
  target_quantity: number;
  work_center: string;
  basic_start_date: Date;
  basic_finish_date: Date;
  assign_stage: boolean;
}

export interface AssignOrder {
  _id: Types.ObjectId;
  production_order_id: Types.ObjectId | ProductionOrder;
  machine_number: string;
  status: string;
  datetime_open_order: Date;
  current_summary: {
    total_good_quantity: number;
    total_not_good_quantity: number;
    last_update: Date;
  };
}

interface DailySummaryData {
  // รูปแบบเดิม (อาจถูกใช้ในส่วนอื่น)
  date?: string;
  total_quantity?: number;
  good_quantity?: number;
  not_good_quantity?: number;

  // เพิ่มฟิลด์ใหม่สำหรับรายงานแบบช่วงวันที่
  date_range?: {
    start_date: string;
    end_date: string;
    days: number;
  };
  shift_type?: 'morning' | 'night' | 'all';
  daily_summaries?: any[];
  lines?: any[];
  total_summary?: {
    factory_total: number;
    factory_good_total: number;
    factory_not_good_total: number;
    line_count: number;
    active_machine_count: number;
  };
}

// วิธีที่ 2: สร้าง interface ใหม่สำหรับรายงานแบบช่วงวันที่และใช้ union type
interface DailySummaryDataForProduct {
  date: string;
  total_quantity: number;
  good_quantity: number;
  not_good_quantity: number;
  // ฟิลด์อื่นๆ ที่จำเป็น
}

interface DateRangeSummaryData {
  date_range: {
    start_date: string;
    end_date: string;
    days: number;
  };
  shift_type: 'morning' | 'night' | 'all';
  daily_summaries: any[]; // คุณอาจต้องกำหนดประเภทข้อมูลที่ชัดเจนกว่านี้
  lines: any[]; // คุณอาจต้องกำหนดประเภทข้อมูลที่ชัดเจนกว่านี้
  total_summary: {
    factory_total: number;
    factory_good_total: number;
    factory_not_good_total: number;
    line_count: number;
    active_machine_count: number;
  };
}
