import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { SqlService } from 'src/shared/services/sql.service';
import * as moment from 'moment';
import { errorMonitor } from 'events';
import { error } from 'console';
import { MasterPart } from 'src/schema/master_parts.schema';
import { ResponseFormat } from 'src/shared/interface';
import { toObjectId } from 'src/shared/utils/type.utils';

@Injectable()
export class SapOrderService {
  constructor(
    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,
    @InjectModel(MasterPart.name)
    private readonly masterPartModel: Model<MasterPart>,
    private readonly sqlService: SqlService,
  ) {}

  // Helper function สำหรับแปลงวันที่ให้เป็นรูปแบบมาตรฐาน ISO
  private parseAndFormatDate(dateString: string): Date | null {
    if (!dateString) return null;

    try {
      // แปลงวันที่จากหลายรูปแบบที่เป็นไปได้
      const parsedDate = moment(dateString).tz('Asia/Bangkok');

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
              ,[GrossWeight]
              ,[NetWeight]
              ,[WeightUnit]
        FROM [SNC-SAP].[dbo].[IIOT_B8_OperationSlip]`;
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
          gross_weight: this.convertToNumber(item.GrossWeight),
          net_weight: this.convertToNumber(item.NetWeight),
          weight_unit: item.WeightUnit,
          condition_amount: null,
          assign_stage: false,
          sql_active: true,
          sql_last_sync: moment().tz('Asia/Bangkok').toDate(), // วันที่ที่ทำการซิงค์ล่าสุด
        };
      });

      // 3. รวบรวม order_id และ work_center ทั้งหมดจาก SQL
      const sqlIdentifiers = new Map();
      transformedData.forEach((item) => {
        const key = `${item.order_id}|${item.work_center}`;
        sqlIdentifiers.set(key, true);
      });

      // 4. ตั้งค่า sql_active = false สำหรับรายการที่ไม่มีใน SQL แล้ว
      const allMongoOrders = await this.productionOrderModel.find({});
      const orderIdsToUpdate = [];

      for (const order of allMongoOrders) {
        const key = `${order.order_id}|${order.work_center}`;
        if (!sqlIdentifiers.has(key)) {
          orderIdsToUpdate.push(order._id);
        }
      }

      let inactivatedCount = 0;
      if (orderIdsToUpdate.length > 0) {
        const inactivateResult = await this.productionOrderModel.updateMany(
          { _id: { $in: orderIdsToUpdate } },
          {
            $set: {
              sql_active: false,
              sql_inactive_date: moment().tz('Asia/Bangkok').toDate(),
            },
          },
        );
        inactivatedCount = inactivateResult.modifiedCount;
      }

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
            inactivated: inactivatedCount,
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

  async autoCreateNewPart(): Promise<ResponseFormat<MasterPart>> {
    try {
      const allMaterials = await this.productionOrderModel
        .distinct('material_number')
        .exec();

      if (!allMaterials || allMaterials.length === 0) {
        return {
          status: 'success',
          message: 'No materials found in production orders',
          data: [],
        };
      }

      // Step 2: Get all existing material_number values from masterPartModel
      const existingMaterials = await this.masterPartModel
        .distinct('material_number')
        .exec();

      // Step 3: Find materials that exist in production orders but not in master parts
      const missingMaterials = allMaterials.filter(
        (material) => !existingMaterials.includes(material),
      );

      if (missingMaterials.length === 0) {
        return {
          status: 'success',
          message: 'All materials from production orders exist in master parts',
          data: [],
        };
      }

      // Step 4: Create new parts for missing materials
      const createdParts: MasterPart[] = [];

      for (const materialNumber of missingMaterials) {
        // Get order information to extract part details
        const order = await this.productionOrderModel
          .findOne({
            material_number: materialNumber,
          })
          .exec();

        if (order) {
          // Create new part with available informationconst
          const partDetail = order.material_description
            ? order.material_description.split(' ')
            : [];
          const indexOfFirstSpace = order.material_description
            ? order.material_description.indexOf(' ')
            : -1;
          const partName =
            indexOfFirstSpace !== -1
              ? order.material_description
                  .substring(indexOfFirstSpace + 1)
                  .trim()
              : '';
          const partNo =
            partDetail.length > 0 ? partDetail[0].trim() : materialNumber;

          const newPart = new this.masterPartModel({
            material_number: materialNumber,
            part_number: partNo, // Generate a default part number
            part_name: partName,
            description:
              order.material_description ||
              `Auto-generated part for ${materialNumber}`,
            weight: 0, // Default weight, can be updated later
            mat: '',
            created_by: toObjectId('67888bf4fa4fd50a5764345b'),
            created_at: moment().tz('Asia/Bangkok').toDate(), // Using Thai timezone as per documentation
          });

          // Save the new part
          const savedPart = await newPart.save();
          createdParts.push(savedPart);

          console.log(`Auto-created new part: ${materialNumber}`);
        }
      }

      // Return success response with all created parts
      return {
        status: 'success',
        message: `Successfully created ${createdParts.length} missing parts`,
        data: createdParts,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to create product :' + (error as Error).message,
        data: [],
      };
    }
  }
  // หรือถ้าต้องการ "activate" order
  async activateOrder(): Promise<void> {
    try {
      await this.productionOrderModel.updateMany(
        { operation_short_text: 'OEE_RUN_TEST' },
        { $set: { sql_active: true } },
      );
    } catch (error) {
      console.error('Error activating order:', error);
    }
  }
}
