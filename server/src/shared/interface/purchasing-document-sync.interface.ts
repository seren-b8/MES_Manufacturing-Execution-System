// purchasing-document-sync.interface.ts
export interface SyncParams {
  plant: string;
  page: number;
  limit: number;
  material?: string;
  purchasing_document?: string;
}

export interface PageResult {
  data: any[];
  hasNextPage: boolean;
  currentPage: number;
  totalPages: number;
}

export interface SyncResult {
  plant?: string;
  synced: number;
  failed: number;
  totalSynced?: number;
  data: any[];
  errors?: any[];
}

export interface ExternalPOResponse {
  success: boolean;
  message: string;
  data: {
    current_page: number;
    per_page: number;
    total_records: number;
    total_pages: number;
    data: Array<{
      purchasing_document: string;
      item: string;
      doc_date: string;
      material: string;
      part_name: string;
      order_qty: string;
      order_unit: string;
      plant: string;
    }>;
  };
}
