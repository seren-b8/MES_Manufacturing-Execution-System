export class QueryLocationDto {
  location_type?:
    | 'warehouse'
    | 'production'
    | 'machine'
    | 'scrap'
    | 'quarantine'
    | 'staging';
  location_code?: string;
  is_active?: boolean;
  has_positions?: boolean;
}
