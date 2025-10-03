// query-transaction.dto.ts
export class QueryTransactionDto {
  transaction_type?: 'receive' | 'transfer' | 'consume';
  material_number?: string;
  location_code?: string;
  user_id?: string;
  production_order_id?: string;
  machine_number?: string;
  start_date?: Date;
  end_date?: Date;
  page?: number;
  limit?: number;
}
