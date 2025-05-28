export interface ProductionSummaryRecord {
  date: string; // วันที่ เช่น "2025-01-15"
  machine_number: string; // หมายเลขเครื่อง เช่น "MC001"
  machine_name: string; // ชื่อเครื่อง
  line: string; // สายการผลิต เช่น "L1", "L2"
  work_center: string; // ศูนย์งาน
  order_id: string; // หมายเลขออเดอร์ เช่น "PO123456"
  material_number: string; // หมายเลขวัสดุ/ชิ้นงาน
  part_description: string; // รายละเอียดชิ้นงาน
  shift: string; // กะทำงาน "morning" หรือ "night"
  shift_start: string; // เวลาเริ่มกะ เช่น "08:00"
  shift_end: string; // เวลาสิ้นสุดกะ เช่น "20:00"
  shift_date_time: string; // วันที่และช่วงเวลากะ เช่น "2025-01-15 08:00-20:00"
  total_quantity: number; // จำนวนผลิตรวม
  good_quantity: number; // จำนวนผลิตดี
  not_good_quantity: number; // จำนวนผลิตเสีย
  good_percentage: number; // เปอร์เซ็นต์ผลิตดี
  assign_order_id: string; // ID ของ AssignOrder
  production_order_id: string; // ID ของ ProductionOrder
  target_quantity: number; // เป้าหมายการผลิต
  order_status: string; // สถานะออเดอร์ "active", "completed", etc.
}
