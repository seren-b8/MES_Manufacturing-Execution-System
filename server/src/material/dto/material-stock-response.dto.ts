// material-stock-response.dto.ts
export class MaterialStockDto {
  location_code: string;
  location_name: string;
  position_code?: string;
  stock_quantity: number;
  lot_number?: string;
}

export class MaterialDetailDto {
  _id: string;
  material_number: string;
  material_description: string;
  unit_of_measurement: string;
  total_stock: number;
  current_stock: MaterialStockDto[];
}
