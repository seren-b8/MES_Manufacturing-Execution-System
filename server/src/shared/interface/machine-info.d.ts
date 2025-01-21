// Updated interfaces
interface IEmployee {
  _id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
}

export interface IUser {
  _id: string;
  employee_id: string;
}

export interface IAssignEmployee {
  _id: string;
  user_id: IUser;
  status: string;
  assign_order_id: string;
}

export interface IEmployeeDetail {
  id: string;
  employee_id: string;
  name: string;
}
