// Interface สำหรับข้อมูลการผลิตแต่ละกะ
interface ShiftSummary {
  good: number; // จำนวนงานดี
  ng: number; // จำนวนงานเสีย
  total: number; // รวมทั้งหมด
}

// Interface หลักสำหรับสรุปการผลิตรายวัน
export interface ProductionDailySummary {
  // ข้อมูลพื้นฐาน
  date: string; // วันที่ผลิต
  machine_number: string; // หมายเลขเครื่องจักร
  order_id: string; // หมายเลขใบสั่งผลิต

  // ข้อมูลวัสดุ
  material_number: string; // หมายเลขวัสดุ
  material_description: string; // รายละเอียดวัสดุ
  target_quantity: number; // จำนวนเป้าหมาย

  // สรุปการผลิต
  good_quantity: number; // จำนวนงานดีรวม
  ng_quantity: number; // จำนวนงานเสียรวม
  total_quantity: number; // จำนวนรวมทั้งหมด
  total_records: number; // จำนวน records ที่รวม

  // ข้อมูลแยกตามกะ
  day_shift: ShiftSummary; // ข้อมูลกะเช้า
  night_shift: ShiftSummary; // ข้อมูลกะดึก
}

export interface ProductionStageSummary {
  date: string;
  machine_number: string;
  order_id: string;
  material_number: string;
  material_description: string;
  target_quantity: number;

  // แยกตาม stage (confirmation_status)
  pending_quantity: number; // รอการยืนยัน
  confirmed_quantity: number; // ยืนยันแล้ว
  rejected_quantity: number; // ปฏิเสธ
  total_quantity: number; // รวมทั้งหมด

  // รายละเอียดแต่ละ stage
  stages: {
    pending: {
      good: number;
      ng: number;
      total: number;
      records: number;
    };
    confirmed: {
      good: number;
      ng: number;
      total: number;
      records: number;
    };
    rejected: {
      good: number;
      ng: number;
      total: number;
      records: number;
    };
  };

  total_records: number;
}

export interface ProductionStageOverview {
  stage: 'confirmed' | 'pending' | 'rejected'; // สถานะการยืนยัน
  total_quantity: number; // จำนวนรวมทั้งหมด
  total_records: number; // จำนวน records ทั้งหมด
  good_quantity: number; // จำนวนงานดี
  ng_quantity: number; // จำนวนงานเสีย
  defect_rate: number; // อัตราความเสียหาย (เปอร์เซ็นต์)
}
