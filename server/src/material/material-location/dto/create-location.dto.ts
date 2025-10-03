export class CreateLocationDto {
  location_name: string;
  location_code: string;
  location_type: string;
  parent_location_id?: string;
  has_positions?: boolean;
  position_format?: string;
  description?: string;
}
