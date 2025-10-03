// query-material.dto.ts
export class QueryMaterialDto {
  material_number?: string;
  material_description?: string;
  location_code?: string;
  has_stock?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'material_number' | 'material_description';
  sort_order?: 'asc' | 'desc';
}
