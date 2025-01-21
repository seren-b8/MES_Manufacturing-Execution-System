export interface ISAPConfirmationLog {
  MANDT: string; // Length: 3
  TID: string; // Length: 32
  ITEMNO: number; // Integer
  EMPLOYEE: string; // Length: 12
  AUFNR: string; // Length: 12 - Order Number
  APLFL: string; // Length: 6
  VORNR: string; // Length: 4 - Operation Number
  UVORN: string; // Length: 4
  LMNGA: number; // Decimal(13,3) - Base Quantity
  MEINH: string; // Length: 3 - Unit of Measure
  XMNGA: number; // Decimal(13,3) - Quantity
  RMNGA: number; // Decimal(13,3)
  RUECK: string; // Length: 10
  RMZHL: string; // Length: 8
  BUDAT: string; // Length: 8 - Posting Date
  ISMNG: number; // Decimal(13,3)
  ISMNGEH: string; // Length: 3
  POSTED: string; // Length: 1
  MESSAGE: string; // Length: 220
  ERDAT: string; // Length: 8 - Creation Date
  ERZET: string; // Length: 6 - Creation Time
  ERNAM: string; // Length: 12 - Created By
  WERKS: string; // Length: 4 - Plant
  AGRND: string; // Length: 4
  TILE: string; // Length: 20
}

export interface AssignOrderData {
  order_id: string;
  sequence_no: string;
  activity: string;
}

export interface MasterNotGoodData {
  case_english: string;
}

export interface AssignEmployeeData {
  user_id: string;
}

export interface PopulatedProductionRecord {
  _id: string;
  assign_order_id: AssignOrderData;
  master_not_good_id?: MasterNotGoodData;
  assign_employee_ids: AssignEmployeeData[];
  quantity: number;
  is_not_good: boolean;
}

export interface GroupedProductionData {
  order_id: string;
  sequence_no: string;
  activity: string;
  is_not_good: boolean;
  case_ng?: string;
  employee_quantities: Map<string, number>;
  snc_quantity: number;
}
