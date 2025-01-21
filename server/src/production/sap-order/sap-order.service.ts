import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductionOrder } from 'src/shared/modules/schema/production-order.schema';
import { SqlService } from 'src/shared/services/sql.service';

@Injectable()
export class SapOrderService {
  constructor(
    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,
    private readonly sqlService: SqlService,
  ) {}

  async syncProductionOrders() {
    try {
      // 1. ดึงข้อมูลจาก SQL Server
      const query = `
        SELECT [Plant]
              ,[Order_ID]
              ,[Mat_No]
              ,[MatDesc]
              ,[BS_StartDate]
              ,[BS_FinishDate]
              ,[TargetQty]
              ,[Unit]
              ,[ScrapQty]
              ,[MRP_Controller]
              ,[MRP_Name]
              ,[ProdSup]
              ,[GrpRounting]
              ,[Opt_task_list_no]
              ,[CounterNo]
              ,[SequenceNo]
              ,[TaskListNode]
              ,[GrpCounter]
              ,[Activity]
              ,[OptShortText]
              ,[ObjectID]
              ,[WorkCenter]
              ,[SetTime1]
              ,[SetTime2]
              ,[SetTime3]
              ,[Lot]
              ,[PlanCT]
              ,[PlanActualTime]
              ,[PlanTargetDay]
              ,[Show_Job]
              ,[LogDate]
        FROM [SNC-SAP].[dbo].[IIOT_IPC_OperationSlip]`;
      const sqlData = await this.sqlService.query(query);

      // 2. แปลงข้อมูลให้ตรงกับ Schema
      const transformedData = sqlData.map((item) => ({
        plant: item.Plant,
        order_id: item.Order_ID,
        material_number: item.Mat_No,
        material_description: item.MatDesc,
        basic_start_date: item.BS_StartDate,
        basic_finish_date: item.BS_FinishDate,
        target_quantity: item.TargetQty,
        unit: item.Unit,
        scrap_quantity: item.ScrapQty,
        mrp_controller: item.MRP_Controller,
        mrp_controller_name: item.MRP_Name,
        production_supervisor: item.ProdSup,
        group_routing: item.GrpRounting,
        operation_task_list_number: item.Opt_task_list_no,
        counter_number: item.CounterNo,
        sequence_number: item.SequenceNo,
        task_list_node: item.TaskListNode,
        group_counter: item.GrpCounter,
        activity: item.Activity,
        operation_short_text: item.OptShortText,
        object_id: item.ObjectID,
        work_center: item.WorkCenter,
        setup_time_1: item.SetTime1,
        setup_time_2: item.SetTime2,
        setup_time_3: item.SetTime3,
        lot: item.Lot,
        plan_cycle_time: item.PlanCT,
        plan_actual_time: item.PlanActualTime,
        plan_target_day: item.PlanTargetDay,
        show_job: item.Show_Job,
        log_date: item.LogDate,
        condition_amount: null, // ถ้าไม่มีใน SQL ให้เป็น null
        assign_stage: false, // ถ้าไม่มีใน SQL ให้เป็น null
      }));

      // 3. ลบข้อมูลเก่า
      await this.productionOrderModel.deleteMany({ assign_stage: false });

      // 4. บันทึกข้อมูลใหม่
      const result =
        await this.productionOrderModel.insertMany(transformedData);

      return {
        status: 'success',
        message: 'Synced production orders successfully',
        data: [
          {
            total: result.length,
          },
        ],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to sync production orders : ' + error.message,
        data: [],
      };
    }
  }
}
