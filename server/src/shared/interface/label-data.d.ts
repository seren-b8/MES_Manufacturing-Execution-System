// interfaces/label-data.interface.ts

export interface PartData {
  orderId: string;
  sapNo: string;
  code: string;
  name: string;
  quantity: number;
  serial: string;
  partImage: string;
}

export interface LabelData {
  labelNo: string;
  customer: string;
  supplier: string;
  mat: string;
  color: string;
  producer: string;
  date: string;
  part1: PartData;
  part2?: PartData; // Optional สำหรับ 2-part label
}

// สำหรับ Co-product (ถ้าต้องการใน future)
export interface CoProductData {
  materialNumber: string;
  quantity: number;
  serial: string;
  partImage?: string;
}

export interface ExtendedLabelData extends LabelData {
  coProduct?: CoProductData;
  iconImage?: string;
}

// สำหรับ API Request
export interface CreateLabelRequest {
  labelType:
    | '1_part'
    | '2_part'
    | 'co_product_combined'
    | 'co_product_separate';
  labelData: LabelData;
  printerId: string;
  copies?: number;
}
