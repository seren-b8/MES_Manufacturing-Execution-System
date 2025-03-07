import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductionOrder } from 'src/shared/modules/schema/production-order.schema';
import { SqlService } from 'src/shared/services/sql.service';
import * as moment from 'moment';

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

      // 2. แปลงข้อมูลให้ตรงกับ Schema และแปลงรูปแบบวันที่
      const transformedData = sqlData.map((item) => {
        // แปลงวันที่จาก string เป็น Date object
        const basicStartDate = this.parseAndFormatDate(item.BS_StartDate);
        const basicFinishDate = this.parseAndFormatDate(item.BS_FinishDate);
        const logDate = this.parseAndFormatDate(item.LogDate);

        return {
          plant: item.Plant,
          order_id: item.Order_ID,
          material_number: item.Mat_No,
          material_description: item.MatDesc,
          basic_start_date: basicStartDate,
          basic_finish_date: basicFinishDate,
          target_quantity: this.convertToNumber(item.TargetQty),
          unit: item.Unit,
          scrap_quantity: this.convertToNumber(item.ScrapQty),
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
          lot: this.convertToNumber(item.Lot),
          plan_cycle_time: this.convertToNumber(item.PlanCT),
          plan_actual_time: this.convertToNumber(item.PlanActualTime),
          plan_target_day: this.convertToNumber(item.PlanTargetDay),
          show_job: this.convertToNumber(item.Show_Job),
          log_date: logDate,
          condition_amount: null,
          assign_stage: false,
        };
      });

      // 3. เตรียมตัวแปรสำหรับเก็บข้อมูล
      const ordersToUpdate = []; // คำสั่งที่ต้องอัพเดต (ไม่รวม workcenter)
      const ordersToCreate = []; // คำสั่งที่ต้องสร้างใหม่
      const ordersWithNewWorkcenter = []; // คำสั่งที่มี workcenter ใหม่

      let updatedCount = 0;
      let createdCount = 0;
      let workCenterChangedCount = 0;

      // 4. ประมวลผลแต่ละรายการ
      for (const item of transformedData) {
        // ค้นหาคำสั่งเดิมที่มี order_id เดียวกัน
        const existingOrders = await this.productionOrderModel.find({
          order_id: item.order_id,
        });

        if (existingOrders.length === 0) {
          // ไม่มี order_id นี้ในระบบ - สร้างใหม่
          ordersToCreate.push(item);
        } else {
          // มี order_id นี้อยู่แล้ว
          // ตรวจสอบว่ามี workcenter ที่ตรงกันหรือไม่
          const exactMatch = existingOrders.find(
            (order) => order.work_center === item.work_center,
          );

          if (exactMatch) {
            // กรณีมี order_id และ work_center ตรงกัน - อัพเดตข้อมูลตามปกติ
            const updateData = { ...item };
            if (exactMatch.assign_stage) {
              updateData.assign_stage = true;
            }

            ordersToUpdate.push({
              _id: exactMatch._id,
              updateData,
            });
          } else {
            // กรณีมี order_id แต่ workcenter ไม่ตรงกัน
            workCenterChangedCount++;

            // 1. อัพเดตข้อมูลเดิมโดยไม่เปลี่ยน workcenter
            for (const existingOrder of existingOrders) {
              // ทำสำเนาข้อมูลใหม่
              const updateData = { ...item };
              // แต่ใช้ workcenter เดิม
              updateData.work_center = existingOrder.work_center;
              // รักษาสถานะ assign
              if (existingOrder.assign_stage) {
                updateData.assign_stage = true;
              }

              ordersToUpdate.push({
                _id: existingOrder._id,
                updateData,
              });
            }

            // 2. สร้างรายการใหม่สำหรับ workcenter ใหม่
            // ตรวจสอบว่า workcenter ใหม่มีอยู่ในข้อมูลเดิมหรือไม่
            const newWorkCenterExists = existingOrders.some(
              (order) => order.work_center === item.work_center,
            );

            if (!newWorkCenterExists) {
              // เฉพาะกรณีที่ workcenter ใหม่ไม่มีอยู่ในข้อมูลเดิม
              ordersWithNewWorkcenter.push(item);
            }
          }
        }
      }

      // 5. ทำการอัพเดตข้อมูล
      for (const order of ordersToUpdate) {
        await this.productionOrderModel.updateOne(
          { _id: order._id },
          { $set: order.updateData },
        );
        updatedCount++;
      }

      // 6. สร้างข้อมูลใหม่
      const allNewOrders = [...ordersToCreate, ...ordersWithNewWorkcenter];
      if (allNewOrders.length > 0) {
        const newOrders =
          await this.productionOrderModel.insertMany(allNewOrders);
        createdCount = newOrders.length;
      }

      return {
        status: 'success',
        message: 'Synced production orders successfully',
        data: [
          {
            updated: updatedCount,
            created: createdCount,
            workCenterChanged: workCenterChangedCount,
            newOrdersCreated: ordersToCreate.length,
            newWorkCenterCreated: ordersWithNewWorkcenter.length,
            total: updatedCount + createdCount,
          },
        ],
      };
    } catch (error) {
      return {
        status: 'error',
        message:
          'Failed to sync production orders: ' + (error as Error).message,
        data: [],
      };
    }
  }

  // Helper function สำหรับแปลงวันที่ให้เป็นรูปแบบมาตรฐาน ISO
  private parseAndFormatDate(dateString: string): Date | null {
    if (!dateString) return null;

    try {
      // แปลงวันที่จากหลายรูปแบบที่เป็นไปได้
      const parsedDate = moment(dateString);

      // ตรวจสอบว่าวันที่ถูกต้องหรือไม่
      if (!parsedDate.isValid()) return null;

      // แปลงเป็น Date object (MongoDB จะจัดเก็บเป็น ISODate โดยอัตโนมัติ)
      return parsedDate.toDate();
    } catch (error) {
      console.error(`Error parsing date: ${dateString}`, error);
      return null;
    }
  }

  // Helper function สำหรับแปลงค่าเป็นตัวเลข
  private convertToNumber(value: any): number | null {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
}
