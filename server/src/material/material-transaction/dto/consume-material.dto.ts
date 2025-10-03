// consume-material.dto.ts
export class ConsumeMaterialDto {
  material_number: string;
  quantity: number;
  from_location_code: string;
  from_position_code?: string;
  lot_number?: string;
  production_order_id: string;
  machine_number?: string;
  reference_doc?: string;
  user_id: string;
  transaction_date?: Date;
}
