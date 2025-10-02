export class GetDailyOEEDto {
  machine_number?: string;
  machine_numbers?: string[];
  start_date?: string;
  end_date?: string;
  has_incomplete_data?: boolean; // เพิ่ม
  exclude_warnings?: boolean; // เพิ่ม
}
