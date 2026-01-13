// src/material/dto/material-inventory-row.dto.ts
export class MaterialInventoryRow {
  material_number: string;
  material_description: string;
  unit_of_measurement: string;
  location_code: string;
  location_name: string;
  position_code?: string;
  lot_number?: string;
  stock_quantity: number;
}
