import { User } from 'src/schema/user.schema';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import {
  CavityAndPartResult,
  DailySummaryData,
  IEmployee,
  IEmployeeDetail,
  IUser,
  TMachineInfo,
} from 'src/shared/interface/machine-info';
import { AssignEmployee } from 'src/schema/assign-employee.schema';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { Employee } from 'src/schema/employee.schema';
import { MachineInfo } from 'src/schema/machine-info.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { MasterCavity } from 'src/schema/master-cavity.schema';
import { CreateMachineInfoDto } from '../dto/machine-info.dto';
import {
  calculateAvailableCounter,
  setMachineCounter,
} from 'src/shared/utils/counter.utils';
import { TimelineMachine } from 'src/schema/timeline-machine.schema';
import * as _ from 'lodash';
import { MasterPart } from 'src/schema/master_parts.schema';
import * as moment from 'moment-timezone';
import { ProductionRecord } from 'src/schema/production-record.schema';
import { PrinterDevice } from 'src/schema/printer-device.schema';
import { count, error } from 'console';
import { toObjectId } from 'src/shared/utils/type.utils';
import { stat } from 'fs';
import path from 'path';

@Injectable()
export class MachineInfoService {
  constructor(
    @InjectModel(MachineInfo.name) private machineInfoModel: Model<MachineInfo>,

    @InjectModel(PrinterDevice.name)
    private readonly printerDeviceModel: Model<PrinterDevice>,

    @InjectModel(AssignOrder.name) private assignOrderModel: Model<AssignOrder>,

    @InjectModel(Employee.name) private employeeModel: Model<Employee>,

    @InjectModel(User.name) private userModel: Model<User>,

    @InjectModel(MasterCavity.name)
    private masterCavityModel: Model<MasterCavity>,

    @InjectModel(ProductionOrder.name)
    private productionOrderModel: Model<ProductionOrder>,

    @InjectModel(AssignEmployee.name)
    private assignEmployeeModel: Model<AssignEmployee>,

    @InjectModel(TimelineMachine.name)
    private timelineMachineModel: Model<TimelineMachine>,

    @InjectModel(MasterPart.name)
    private masterPartModel: Model<MasterPart>,

    @InjectModel(ProductionRecord.name)
    private productionRecordModel: Model<ProductionRecord>,
  ) {}

  private calculateAchievementRate(
    totalGood: number,
    targetQuantity: number,
  ): number {
    if (!targetQuantity) return 0;
    return Math.round((totalGood / targetQuantity) * 10000) / 100; // Round to 2 decimal places
  }

  private calculateProductionDate(date?: Date): Date {
    // ใช้ moment.tz กับเขตเวลาประเทศไทย
    const thaiTime = date
      ? moment(date).tz('Asia/Bangkok')
      : moment().tz('Asia/Bangkok');

    const cutoffHour = 8; // 8:00 AM

    // ตรวจสอบว่าเวลาปัจจุบันอยู่ก่อน 8:00 น. หรือไม่
    if (thaiTime.hour() < cutoffHour) {
      // ถ้าก่อน 8:00 น. ให้ใช้วันที่ของวันก่อนหน้า
      thaiTime.subtract(1, 'days');
    }

    // ตั้งเวลาเป็น 00:00:00 เพื่อให้มีแค่วันที่
    thaiTime.startOf('day');

    // แปลงกลับเป็น JavaScript Date object
    return thaiTime.toDate();
  }

  private analyzeMachineData(
    machineGroups: Map<string, any[]>,
    startDate: Date,
    endDate: Date,
    intervalMinutes: number,
    allStatuses: string[],
  ) {
    const result = [];

    // แปลงเวลาเป็น timestamp เพื่อความเร็วในการคำนวณ
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const intervalMs = intervalMinutes * 60 * 1000;

    // สร้างช่วงเวลา
    const intervalStarts = [];
    for (let time = startTime; time < endTime; time += intervalMs) {
      intervalStarts.push(time);
    }

    // วิเคราะห์ข้อมูลสำหรับแต่ละเครื่องจักร
    for (const [machineNumber, records] of machineGroups.entries()) {
      const intervals = [];

      if (records.length === 0) continue;

      // เพิ่ม next_datetime ให้กับแต่ละ record เพื่อคำนวณระยะเวลา
      for (let i = 0; i < records.length - 1; i++) {
        records[i].next_datetime = records[i + 1].datetime;
      }

      // record สุดท้ายใช้เวลาสิ้นสุดของช่วงเวลาที่ต้องการวิเคราะห์
      records[records.length - 1].next_datetime = endDate;

      // วิเคราะห์แต่ละช่วงเวลา
      for (const intervalStart of intervalStarts) {
        const intervalEnd = intervalStart + intervalMs;

        // ตำแหน่งเริ่มต้นและสิ้นสุดของช่วงเวลานี้
        const intervalStartMoment = moment(new Date(intervalStart)).tz(
          'Asia/Bangkok',
        );
        const intervalEndMoment = moment(new Date(intervalEnd)).tz(
          'Asia/Bangkok',
        );

        // ตรวจสอบว่าช่วงเวลานี้มีข้อมูลหรือไม่
        let hasDataInInterval = false;
        const statusDurations = {};

        // เริ่มต้นให้ทุกสถานะมีค่าเป็น 0
        allStatuses.forEach((status) => {
          statusDurations[status] = 0;
        });

        // หาสถานะในช่วงเวลานี้
        let totalDurationInInterval = 0;

        for (const record of records) {
          const recordTime = record.datetime.getTime();
          const nextRecordTime = record.next_datetime.getTime();

          // ตรวจสอบว่า record อยู่ในช่วงเวลาที่กำลังวิเคราะห์หรือไม่
          if (recordTime < intervalEnd && nextRecordTime > intervalStart) {
            // คำนวณจุดเริ่มต้นและสิ้นสุดที่อยู่ในช่วงเวลานี้
            const overlapStart = Math.max(recordTime, intervalStart);
            const overlapEnd = Math.min(nextRecordTime, intervalEnd);

            // คำนวณระยะเวลาเป็นนาที
            const durationMs = overlapEnd - overlapStart;

            // ป้องกันระยะเวลาติดลบ
            if (durationMs <= 0) continue;

            const durationMinutes = Math.min(
              durationMs / (60 * 1000),
              intervalMinutes,
            ); // จำกัดให้ไม่เกินขนาดช่วงเวลา

            // บันทึกระยะเวลาของสถานะนี้
            statusDurations[record.status] += durationMinutes;
            totalDurationInInterval += durationMinutes;
          }
        }

        // ตรวจสอบว่าผลรวมของระยะเวลาทั้งหมดไม่เกินขนาดช่วงเวลา
        if (
          Math.abs(totalDurationInInterval - intervalMinutes) > 0.01 &&
          totalDurationInInterval > 0
        ) {
          // ปรับสัดส่วนระยะเวลาให้รวมเท่ากับขนาดช่วงเวลา
          const scaleFactor = intervalMinutes / totalDurationInInterval;
          for (const status of allStatuses) {
            statusDurations[status] *= scaleFactor;
          }
        }
        // แปลงทศนิยมให้แสดงแค่ 2 ตำแหน่ง
        for (const status of allStatuses) {
          statusDurations[status] = parseFloat(
            statusDurations[status].toFixed(2),
          );
        }

        // เพิ่มข้อมูลช่วงเวลานี้ (แม้ไม่มีข้อมูล ก็จะแสดง 0 สำหรับทุกสถานะ)
        intervals.push({
          start_time: intervalStartMoment.format('YYYY-MM-DD HH:mm:ss'),
          ...statusDurations,
        });
      }

      // เพิ่มข้อมูลเครื่องจักรนี้เข้าในผลลัพธ์
      result.push({
        machine_number: machineNumber,
        intervals,
      });
    }

    return result;
  }

  private groupByMachine(timelineData: any[]) {
    const machineGroups = new Map();

    for (const record of timelineData) {
      const machineNumber = record.machine_number;

      if (!machineGroups.has(machineNumber)) {
        machineGroups.set(machineNumber, []);
      }

      machineGroups.get(machineNumber).push({
        status: record.status,
        datetime:
          record.createdAt instanceof Date
            ? record.createdAt
            : new Date(record.createdAt),
      });
    }

    return machineGroups;
  }

  /**
   * รีเซ็ต counter ของเครื่องจักรเฉพาะเครื่อง (จากโค้ดเดิม)
   */
  private async resetMachineCounter(
    machineNumber: string,
    isActive: boolean,
  ): Promise<void> {
    try {
      const machine = await this.machineInfoModel.findOne({
        machine_number: machineNumber,
      });

      if (!machine) {
        throw new Error(`Machine ${machineNumber} not found`);
      }

      const updateData: any = {};

      if (isActive) {
        // กรณีมี active order - ใช้สำหรับเปิด order หรือกลับมาทำงานต่อ
        updateData.is_counter_paused = false;
        this.setMachineCounter(machineNumber, 0);
      } else {
        // กรณีไม่มี active order - ใช้สำหรับปิด order หรือระงับงาน
        updateData.recorded_counter = 0;
        updateData.is_counter_paused = false;
        updateData.pause_start_counter = null;
      }

      await this.machineInfoModel.findOneAndUpdate(
        { machine_number: machineNumber },
        updateData,
      );
    } catch (error) {
      console.error(
        `Failed to reset counter for machine ${machineNumber}:`,
        error,
      );
      throw error;
    }
  }

  async getAllMachinesDetails(): Promise<ResponseFormat<any>> {
    try {
      const collectionNames = {
        machine: this.machineInfoModel.collection.collectionName,
        order: this.productionOrderModel.collection.collectionName,
        assignOrder: this.assignOrderModel.collection.collectionName,
        productionRecord: this.productionRecordModel.collection.collectionName,
        assignEmployee: this.assignEmployeeModel.collection.collectionName,
        employee: this.employeeModel.collection.collectionName,
        user: this.userModel.collection.collectionName,
        cavity: this.masterCavityModel.collection.collectionName,
        part: this.masterPartModel.collection.collectionName,
      };

      const productionDateNow = this.calculateProductionDate();

      const userLookupPipeline = [
        {
          $lookup: {
            from: collectionNames.user,
            let: { userId: '$user_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$userId'] } } },
              {
                $lookup: {
                  from: collectionNames.employee,
                  let: { employeeId: '$employee_id' },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $eq: ['$employee_id', '$$employeeId'] },
                      },
                    },
                  ],
                  as: 'employee',
                },
              },
              {
                $project: {
                  _id: 1,
                  employee_id: 1,
                  role: 1,
                  first_name: { $arrayElemAt: ['$employee.first_name', 0] },
                  last_name: { $arrayElemAt: ['$employee.last_name', 0] },
                },
              },
            ],
            as: 'user',
          },
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      const assignEmployeePipeline = [
        {
          $lookup: {
            from: collectionNames.assignEmployee,
            let: { assignOrderId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$assign_order_id', '$$assignOrderId'] },
                      { $eq: ['$status', 'active'] },
                    ],
                  },
                },
              },
              ...userLookupPipeline,
              {
                $project: {
                  user: '$user',
                },
              },
            ],
            as: 'assign_employees',
          },
        },
      ];

      const productionRecordPipeline = [
        {
          $lookup: {
            from: collectionNames.productionRecord,
            let: { assignOrderId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$assign_order_id', '$$assignOrderId'] },
                },
              },
              {
                $match: {
                  production_date: {
                    $gte: productionDateNow,
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  total_quantity: { $sum: '$quantity' },
                  not_good_quantity: {
                    $sum: {
                      $cond: [{ $eq: ['$is_not_good', true] }, '$quantity', 0],
                    },
                  },
                  good_quantity: {
                    $sum: {
                      $cond: [{ $eq: ['$is_not_good', false] }, '$quantity', 0],
                    },
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  total_quantity: { $ifNull: ['$total_quantity', 0] },
                  good_quantity: { $ifNull: ['$good_quantity', 0] },
                  not_good_quantity: { $ifNull: ['$not_good_quantity', 0] },
                },
              },
            ],
            as: 'daily_summary_array',
          },
        },
        {
          $addFields: {
            daily_summary: {
              $cond: {
                if: { $gt: [{ $size: '$daily_summary_array' }, 0] },
                then: { $arrayElemAt: ['$daily_summary_array', 0] },
                else: {
                  total_quantity: 0,
                  good_quantity: 0,
                  not_good_quantity: 0,
                },
              },
            },
          },
        },
        // ลบฟิลด์ชั่วคราวออก
        {
          $project: {
            daily_summary_array: 0,
          },
        },
      ];

      const cavityPipeline = [
        {
          $lookup: {
            from: collectionNames.cavity, // Collection ของ cavity
            let: { partId: '$_id' }, // หรือฟิลด์อื่นๆ ที่ใช้อ้างอิง
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$$partId', '$parts'] }, // สมมติว่า 'parts' เป็น array ของ part IDs ใน cavity
                },
              },
            ],
            as: 'cavities',
          },
        },
      ];

      const partPipeline = [
        {
          $lookup: {
            from: collectionNames.part,
            let: { materialNumber: '$material_number' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$material_number', '$$materialNumber'] },
                },
              },
              ...cavityPipeline,
            ],
            as: 'part',
          },
        },
      ];

      const orderPipeline = [
        {
          $lookup: {
            from: collectionNames.order,
            let: { orderId: '$production_order_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$orderId'] },
                },
              },
              ...partPipeline,
            ],
            as: 'orders',
          },
        },
      ];

      const orderStatusPipeline = [
        {
          $lookup: {
            from: collectionNames.order,
            let: { workCenter: '$work_center' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$work_center', '$$workCenter'] },
                  sql_active: true, // order ที่ active จาก SQL
                },
              },
              // Lookup เพื่อหา assign orders ทั้งหมดที่เกี่ยวข้องกับ order นี้
              {
                $lookup: {
                  from: collectionNames.assignOrder,
                  let: { orderId: '$_id' },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $eq: ['$production_order_id', '$$orderId'] },
                      },
                    },
                    // Project เฉพาะฟิลด์ที่จำเป็น
                    {
                      $project: {
                        _id: 1,
                        status: 1,
                        machine_number: 1,
                        current_summary: 1,
                      },
                    },
                  ],
                  as: 'assign_orders',
                },
              },
              // เพิ่มฟิลด์สำหรับระบุสถานะของ order
              {
                $addFields: {
                  // กรณีไม่มี assign_orders เลย และ assign_stage = false คือรอ sync
                  is_waiting_sync: {
                    $and: [
                      { $eq: [{ $size: '$assign_orders' }, 0] },
                      { $eq: ['$assign_stage', false] },
                    ],
                  },
                  // นับจำนวน suspended orders
                  suspended_count: {
                    $size: {
                      $filter: {
                        input: '$assign_orders',
                        as: 'assign',
                        cond: { $eq: ['$$assign.status', 'suspended'] },
                      },
                    },
                  },
                  // ดึง suspended orders มาเก็บ
                  suspended_orders: {
                    $filter: {
                      input: '$assign_orders',
                      as: 'assign',
                      cond: { $eq: ['$$assign.status', 'suspended'] },
                    },
                  },
                },
              },
              // แยก orders ตามสถานะ
              {
                $facet: {
                  // Orders ที่รอ sync
                  waiting_sync: [
                    { $match: { is_waiting_sync: true } },
                    {
                      $project: {
                        _id: 1,
                        order_id: 1,
                        material_number: 1,
                        target_quantity: 1,
                      },
                    },
                  ],
                  // Orders ที่มีสถานะ suspended
                  suspended: [
                    { $match: { suspended_count: { $gt: 0 } } },
                    {
                      $project: {
                        _id: 1,
                        order_id: 1,
                        material_number: 1,
                        target_quantity: 1,
                        suspended_orders: 1,
                      },
                    },
                  ],
                  // สรุปจำนวน orders ตามสถานะ
                  summary: [
                    {
                      $group: {
                        _id: null,
                        total_orders: { $sum: 1 },
                        waiting_sync_count: {
                          $sum: { $cond: ['$is_waiting_sync', 1, 0] },
                        },
                        suspended_count: { $sum: '$suspended_count' },
                      },
                    },
                  ],
                },
              },
            ],
            as: 'order_status',
          },
        },
        // แปลงผลลัพธ์จาก facet ให้ใช้งานง่ายขึ้น
        {
          $addFields: {
            waiting_sync_orders: {
              $arrayElemAt: ['$order_status.waiting_sync', 0],
            },
            suspended_order_details: {
              $arrayElemAt: ['$order_status.suspended', 0],
            },
            order_summary: { $arrayElemAt: ['$order_status.summary', 0] },
          },
        },
        // เพิ่มฟิลด์สำหรับนับจำนวน
        {
          $addFields: {
            waiting_sync_count: { $size: '$waiting_sync_orders' },
            suspended_orders_count: { $sum: '$order_summary.suspended_count' },
          },
        },
      ];

      // Pipeline สำหรับ active assign orders
      const activeAssignOrdersPipeline = [
        {
          $lookup: {
            from: collectionNames.assignOrder,
            let: { machineNumber: '$machine_number' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$machine_number', '$$machineNumber'] },
                  status: 'active',
                },
              },
              ...orderPipeline,
              ...productionRecordPipeline,
              ...assignEmployeePipeline,
              {
                $project: {
                  order: '$orders',
                  assign_employees: '$assign_employees.user',
                  daily_summary: '$daily_summary',
                  current_summary: 1,
                },
              },
            ],
            as: 'assign_orders',
          },
        },
      ];

      // Pipeline หลักที่รวมทุก pipeline เข้าด้วยกัน
      const mainPipeline = [
        ...activeAssignOrdersPipeline,
        ...orderStatusPipeline,
        {
          $project: {
            _id: 1,
            machine_name: 1,
            work_center: 1,
            machine_number: 1,
            tonnage: 1,
            line: 1,
            status: 1,
            counter: 1,
            recorded_counter: 1,
            is_counter_paused: 1,
            pause_start_counter: 1,
            cycle_time: 1,

            assign_orders: 1,
            waiting_sync_count: 1, // เก็บเฉพาะจำนวน
            suspended_orders_count: 1, // เก็บเฉพาะจำนวน
            // ลบ fields เหล่านี้โดยไม่ระบุ
            // waiting_sync_orders: 0,
            // suspended_order_details: 0,
            // order_summary: 0,
            // order_status: 0
          },
        },
      ];

      const machines = await this.machineInfoModel.aggregate(mainPipeline);

      this.createOptimalIndexes();

      // จัดรูปแบบข้อมูลใหม่ตามที่คุณต้องการ
      const formattedMachines = machines.map((machine) => {
        const cavity =
          machine.assign_orders?.[0]?.order?.[0]?.part?.[0]?.cavities?.[0]
            ?.cavity ?? 1;

        const availableCounter = calculateAvailableCounter(
          machine.counter,
          machine.recorded_counter,
          cavity,
          machine.is_counter_paused || false,
          machine.pause_start_counter || null,
        );
        const machineInfo = {
          machine_name: machine.machine_name,
          work_center: machine.work_center,
          machine_number: machine.machine_number,
          line: machine.line,
          status: machine.status,
          counter: machine.counter,
          available_counter: availableCounter,
          tonnage: machine.tonnage,
          cycle_time: machine.cycle_time,
          is_counter_paused: machine.is_counter_paused || false,
        };

        const orderSummary = {
          suspended_orders: machine.suspended_orders_count,
          waiting_assign_orders: machine.waiting_sync_count,
          total_orders:
            machine.suspended_orders_count + machine.waiting_sync_count,
        };

        let formatActiveOrders = [];
        if (machine.assign_orders.length > 0) {
          formatActiveOrders = machine.assign_orders.map((activeOrder) => {
            const productionOrder = activeOrder.order[0];
            const activeOrderData = {
              order_id: activeOrder._id,
              production_order: {
                id: productionOrder._id,
                order_number: productionOrder.order_id,
                material_number: productionOrder.material_number,
                material_description: productionOrder.material_description,
                target_quantity: productionOrder.target_quantity,
                target_daily: productionOrder.plan_target_day,
                plan_cycle_time: productionOrder.plan_cycle_time,
                part_info: {
                  weight: productionOrder.part?.[0]?.weight ?? 0,
                  weight_runner:
                    productionOrder.part?.[0]?.cavities?.[0]?.runner ?? 0,
                },
              },
              production_summary: activeOrder.current_summary ?? {},
              daily_summary: activeOrder.daily_summary ?? {},
              employees: activeOrder.assign_employees.map((emp) => {
                const employeeData = {
                  id: emp._id,
                  employee_id: emp.employee_id,
                  name: emp.first_name + ' ' + emp.last_name,
                };
                return employeeData;
              }),
            };
            return activeOrderData;
          });
        }

        return {
          machine_info: machineInfo,
          orders_summary: orderSummary,
          active_orders: formatActiveOrders,
        };
      });

      return {
        status: 'success',
        message: 'All machine info retrieved successfully',
        data: formattedMachines,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to get all machine info: ' + (error as Error).message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async createOptimalIndexes(): Promise<void> {
    try {
      await this.machineInfoModel.collection.createIndex(
        { work_center: 1 },
        { background: true },
      );
      await this.productionOrderModel.collection.createIndex(
        { work_center: 1, sql_active: 1 },
        { background: true },
      );
      await this.assignOrderModel.collection.createIndex(
        { production_order_id: 1, status: 1 },
        { background: true },
      );
      await this.assignEmployeeModel.collection.createIndex(
        { assign_order_id: 1, status: 1 },
        { background: true },
      );
      await this.productionRecordModel.collection.createIndex(
        { assign_order_id: 1 },
        { background: true },
      );
    } catch (error) {
      console.error('Index creation error:', error);
    }
  }

  async createMachineInfo(
    data: CreateMachineInfoDto,
  ): Promise<ResponseFormat<MachineInfo>> {
    try {
      if (!data.machine_number || !data.work_center) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine number and work center are required',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const machine = new this.machineInfoModel(data);
      await machine.save();

      return {
        status: 'success',
        message: 'Machine created successfully',
        data: [machine],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to create machine',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // เพิ่มหรืออัพเดทเครื่องพิมพ์ให้กับเครื่องจักร
  async assignPrinterToMachine(
    machineId: string,
    printerId: string,
  ): Promise<ResponseFormat<MachineInfo>> {
    try {
      // ตรวจสอบว่าเครื่องจักรมีอยู่จริง
      const machine = await this.machineInfoModel.findById(machineId).exec();
      if (!machine) {
        throw new HttpException(
          {
            status: 'error',
            message: `Machine with ID ${machineId} not found`,
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ตรวจสอบว่าเครื่องพิมพ์มีอยู่จริง
      const printer = await this.printerDeviceModel.findById(printerId).exec();
      if (!printer) {
        throw new HttpException(
          {
            status: 'error',
            message: `Printer with ID ${printerId} not found`,
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ใช้ updateOne เพื่อหลีกเลี่ยงการตรวจสอบเงื่อนไขของฟิลด์อื่นๆ
      const result = await this.machineInfoModel.updateOne(
        { _id: machineId },
        {
          printer_id: new Types.ObjectId(printerId),
          updated_at: moment().toDate(),
        },
      );

      if (result.modifiedCount === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: `Failed to update machine with ID ${machineId}`,
            data: [],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // ดึงข้อมูลที่อัปเดตแล้วมาแสดงผล
      const updatedMachine = await this.machineInfoModel
        .findById(machineId)
        .exec();

      return {
        status: 'success',
        message: 'Printer assigned to machine successfully',
        data: [updatedMachine],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Failed to assign printer to machine: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ลบเครื่องพิมพ์ออกจากเครื่องจักร
  async removePrinterFromMachine(
    machineId: string,
  ): Promise<ResponseFormat<MachineInfo>> {
    try {
      // ตรวจสอบความถูกต้องของ ID
      if (!machineId || !Types.ObjectId.isValid(machineId)) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Invalid machine ID format',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // ตรวจสอบว่าเครื่องจักรมีอยู่จริง
      const machine = await this.machineInfoModel.findById(machineId).exec();
      if (!machine) {
        throw new HttpException(
          {
            status: 'error',
            message: `Machine with ID ${machineId} not found`,
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ตรวจสอบว่ามีเครื่องพิมพ์เชื่อมต่ออยู่หรือไม่
      if (!machine.printer_id) {
        throw new HttpException(
          {
            status: 'error',
            message: 'No printer is currently connected to this machine',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // ใช้วิธีการอัพเดทโดยตรงผ่าน MongoDB เพื่อหลีกเลี่ยงปัญหา validation
      const updateResult = await this.machineInfoModel.updateOne(
        { _id: machineId },
        {
          $set: {
            printer_id: null,
            updated_at: moment().toDate(),
          },
        },
      );

      // ตรวจสอบว่ามีการอัพเดทเกิดขึ้นหรือไม่
      if (updateResult.modifiedCount === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Failed to update machine. No changes were made.',
            data: [],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // ดึงข้อมูลเครื่องจักรที่อัพเดทแล้ว
      const updatedMachine = await this.machineInfoModel
        .findById(machineId)
        .exec();

      return {
        status: 'success',
        message: 'Printer removed from machine successfully',
        data: [updatedMachine],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Failed to remove printer from machine: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ดึงข้อมูลเครื่องพิมพ์ของเครื่องจักร
  async getMachinePrinter(machineNumber: string): Promise<ResponseFormat<any>> {
    try {
      // ดึงข้อมูลเครื่องจักรพร้อม populate ข้อมูลเครื่องพิมพ์
      const machine = await this.machineInfoModel
        .findOne({ machine_number: machineNumber })
        .populate('printer_id')
        .exec();

      if (!machine) {
        throw new HttpException(
          {
            status: 'error',
            message: `Machine with ID ${machineNumber} not found`,
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (!machine.printer_id) {
        return {
          status: 'success',
          message: 'No printer assigned to this machine',
          data: [],
        };
      }

      // จัดรูปแบบข้อมูลเครื่องพิมพ์
      const printer = machine.printer_id as unknown as PrinterDevice;

      return {
        status: 'success',
        message: 'Machine printer retrieved successfully',
        data: [
          {
            printer_id: printer._id,
            device_name: printer.device_name,
            ip_device: printer.ip_device,
            status: printer.status,
            printer_type: printer.printer_type,
            location: printer.location,
            description: printer.description,
          },
        ],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get machine printer: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ดึงข้อมูลเครื่องจักรทั้งหมดพร้อมเครื่องพิมพ์
  async getAllMachinesWithPrinters(): Promise<ResponseFormat<any>> {
    try {
      const machines = await this.machineInfoModel
        .find()
        .populate('printer_id')
        .exec();

      // จัดรูปแบบข้อมูล
      const machinesWithPrinters = machines.map((machine) => {
        const printer = machine.printer_id as unknown as PrinterDevice;

        return {
          machine_id: machine._id,
          machine_number: machine.machine_number,
          machine_name: machine.machine_name,
          work_center: machine.work_center,
          line: machine.line,
          status: machine.status,
          printer: printer
            ? {
                printer_id: printer._id,
                device_name: printer.device_name,
                ip_device: printer.ip_device,
                status: printer.status,
                printer_type: printer.printer_type,
              }
            : null,
        };
      });

      return {
        status: 'success',
        message: 'All machines with printers retrieved successfully',
        data: machinesWithPrinters,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to get machines with printers: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ค้นหาเครื่องจักรตามเครื่องพิมพ์
  async findMachinesByPrinter(
    printerId: string,
  ): Promise<ResponseFormat<MachineInfo>> {
    try {
      const machines = await this.machineInfoModel
        .find({
          printer_id: toObjectId(printerId),
        })
        .exec();

      return {
        status: 'success',
        message: `Found ${machines.length} machines using this printer`,
        data: machines,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: `Failed to find machines by printer: ${(error as Error).message}`,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getDailySummary(
    orderId: string | Types.ObjectId,
  ): Promise<ResponseFormat<DailySummaryData>> {
    try {
      const orderObjectId = toObjectId(orderId);

      // Get AssignOrder data for validation
      const assignOrder = await this.assignOrderModel.findById(orderObjectId);
      if (!assignOrder) {
        throw new Error('Order not found');
      }

      // Get start date from order's datetime_open_order
      const now = moment().utc();

      // Adjust to nearest 8:00 AM Bangkok time backward
      const startDate = moment(now)
        .tz('Asia/Bangkok')
        .startOf('day')
        .add(8, 'hours')
        .utc(); // แปลงกลับเป็น UTC

      if (moment(now).tz('Asia/Bangkok').hour() < 8) {
        startDate.subtract(1, 'day');
      }

      const endDate = moment(startDate).utc().add(1, 'day');

      // Create array of date ranges
      const records = await this.productionRecordModel
        .find({
          assign_order_id: orderObjectId,
          createdAt: {
            $gte: startDate.toDate(),
            $lt: endDate.toDate(),
          },
        })
        .lean();

      const summary = {
        date: startDate.format('YYYY-MM-DD'),
        total_quantity: 0,
        good_quantity: 0,
        not_good_quantity: 0,
      };
      // Get production records for each date range

      records.forEach((record) => {
        const quantity = record.quantity || 0;
        summary.total_quantity += quantity;

        if (record.is_not_good) {
          summary.not_good_quantity += quantity;
        } else {
          summary.good_quantity += quantity;
        }
      });

      return {
        status: 'success',
        message: 'Daily production summary retrieved successfully',
        data: [summary], // ส่งกลับเป็น array เพื่อให้ตรงกับ ResponseFormat
      };
    } catch (error) {
      return {
        status: 'error',
        message:
          (error as Error).message || 'Failed to retrieve daily summaries',
        data: [],
      };
    }
  }

  async toggleCounter(
    machineNumber: string,
  ): Promise<ResponseFormat<MachineInfo>> {
    try {
      const machine = await this.machineInfoModel.findOne({
        machine_number: machineNumber,
      });
      if (!machine) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      let updateData: any;

      if (!machine.is_counter_paused) {
        // Pause counter
        updateData = {
          is_counter_paused: true,
          pause_start_counter: machine.counter,
        };
      } else {
        // Resume counter
        const counterDifference = machine.counter - machine.pause_start_counter;
        updateData = {
          is_counter_paused: false,
          pause_start_counter: null,
          recorded_counter: machine.recorded_counter + counterDifference,
        };
      }

      const updatedMachine = await this.machineInfoModel.findOneAndUpdate(
        { machine_number: machineNumber },
        updateData,
        { new: true },
      );

      return {
        status: 'success',
        message: `Counter ${machine.is_counter_paused ? 'resumed' : 'paused'} successfully`,
        data: [updatedMachine],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to toggle counter',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async resetCounter(
    machineNumber: string,
  ): Promise<ResponseFormat<MachineInfo>> {
    try {
      if (!machineNumber) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine number is required',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const machine = await this.machineInfoModel.findOne({
        machine_number: machineNumber,
      });

      if (!machine) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const updateData = {
        recorded_counter: machine.counter,
      };

      const updatedMachine = await this.machineInfoModel.findOneAndUpdate(
        { machine_number: machineNumber },
        updateData,
        { new: true },
      );

      return {
        status: 'success',
        message: 'Counter reset successfully',
        data: [updatedMachine],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to reset counter',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getMachineStatusByPeriod(
    startDate: Date,
    endDate: Date,
    intervalMinutes: number = 10,
    machineNumbers?: string[],
  ): Promise<ResponseFormat<any>> {
    try {
      // 1. แปลงวันที่เป็นเขตเวลาประเทศไทย
      const start = moment(startDate).tz('Asia/Bangkok').toDate();
      const end = moment(endDate).tz('Asia/Bangkok').toDate();

      // 2. สร้างเงื่อนไขสำหรับการค้นหา
      const findCondition: any = {
        createdAt: { $gte: start, $lte: end },
      };

      if (machineNumbers?.length) {
        findCondition.machine_number = { $in: machineNumbers };
      }

      // 3. ดึงข้อมูล timeline โดยตรงจาก MongoDB
      const timelineData = await this.timelineMachineModel
        .find(findCondition)
        .select('machine_number status createdAt')
        .sort({ machine_number: 1, createdAt: 1 })
        .lean()
        .exec();

      // 4. ถ้าไม่มีข้อมูล ส่งกลับ array ว่าง
      if (!timelineData.length) {
        return {
          status: 'success',
          message: 'No machine timeline data found in the specified date range',
          data: [],
        };
      }

      // 5. หา machine statuses ทั้งหมดที่มีในระบบ
      const allStatuses = new Set<string>();
      timelineData.forEach((record) => {
        if (record.status) {
          allStatuses.add(record.status);
        }
      });

      const statusArray = Array.from(allStatuses);

      // 6. จัดกลุ่มข้อมูลตามเครื่องจักร
      const machineGroups = this.groupByMachine(timelineData);

      // 7. วิเคราะห์ข้อมูลตามช่วงเวลาที่กำหนด
      const analysisResult = this.analyzeMachineData(
        machineGroups,
        start,
        end,
        intervalMinutes,
        statusArray,
      );

      // 8. ส่งผลลัพธ์กลับตาม ResponseFormat
      return {
        status: 'success',
        message: `Retrieved machine status analysis successfully for ${analysisResult.length} machines`,
        data: analysisResult,
      };
    } catch (error) {
      console.error('Error in getMachineStatusByPeriod:', error);
      throw new HttpException(
        {
          status: 'error',
          message:
            'Failed to analyze machine status: ' + (error as Error).message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async setMachineCounter(
    machineNumber: string,
    counter: number,
  ): Promise<ResponseFormat<any>> {
    try {
      // ตรวจสอบค่า counter
      if (counter < 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'counter cannot be under 0',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const collectionNames = {
        machine: this.machineInfoModel.collection.collectionName,
        order: this.productionOrderModel.collection.collectionName,
        assignOrder: this.assignOrderModel.collection.collectionName,
        productionRecord: this.productionRecordModel.collection.collectionName,
        assignEmployee: this.assignEmployeeModel.collection.collectionName,
        employee: this.employeeModel.collection.collectionName,
        user: this.userModel.collection.collectionName,
        cavity: this.masterCavityModel.collection.collectionName,
        part: this.masterPartModel.collection.collectionName,
      };

      // ใช้ Aggregation Pipeline เพื่อรวบรวมข้อมูลทั้งหมดในครั้งเดียว
      const aggregationResult = await this.machineInfoModel.aggregate([
        // Stage 1: Match machine by machine_number
        {
          $match: {
            machine_number: machineNumber,
          },
        },

        // Stage 2: Lookup active assign_order
        {
          $lookup: {
            from: collectionNames.assignOrder,
            let: { machineNumber: '$machine_number' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$machine_number', '$$machineNumber'] },
                      { $eq: ['$status', 'active'] },
                    ],
                  },
                },
              },
            ],
            as: 'assignOrders',
          },
        },

        // Stage 3: Unwind assign orders (should be only one active)
        {
          $unwind: {
            path: '$assignOrders',
            preserveNullAndEmptyArrays: false,
          },
        },

        // Stage 4: Lookup production order
        {
          $lookup: {
            from: collectionNames.order,
            localField: 'assignOrders.production_order_id',
            foreignField: '_id',
            as: 'productionOrders',
          },
        },

        // Stage 5: Unwind production orders
        {
          $unwind: {
            path: '$productionOrders',
            preserveNullAndEmptyArrays: false,
          },
        },

        // Stage 6: Lookup master parts
        {
          $lookup: {
            from: collectionNames.part, //'master_parts'
            localField: 'productionOrders.material_number',
            foreignField: 'material_number',
            as: 'masterParts',
          },
        },

        // Stage 7: Unwind master parts
        {
          $unwind: {
            path: '$masterParts',
            preserveNullAndEmptyArrays: false,
          },
        },

        // Stage 8: Lookup master cavity
        {
          $lookup: {
            from: collectionNames.cavity,
            let: { partId: '$masterParts._id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$$partId', '$parts'],
                  },
                },
              },
            ],
            as: 'masterCavities',
          },
        },

        // Stage 9: Project final result with cavity calculation
        {
          $project: {
            machine_number: 1,
            machine_name: 1,
            work_center: 1,
            line: 1,
            tonnage: 1,
            status: 1,
            is_counter_paused: 1,
            counter: 1,
            recorded_counter: 1,
            pause_start_counter: 1,
            assignOrder: '$assignOrders',
            productionOrder: '$productionOrders',
            masterPart: '$masterParts',
            cavity: {
              $ifNull: [
                { $arrayElemAt: ['$masterCavities.cavity', 0] },
                1, // default cavity value
              ],
            },
          },
        },
      ]);

      // ตรวจสอบผลลัพธ์จาก aggregation
      if (!aggregationResult || aggregationResult.length === 0) {
        // ตรวจสอบว่าเครื่องจักรมีอยู่จริงหรือไม่
        const machineExists = await this.machineInfoModel
          .findOne({
            machine_number: machineNumber,
          })
          .select('machine_number')
          .lean();

        if (!machineExists) {
          throw new HttpException(
            {
              status: 'error',
              message: 'invalid machine',
              data: [],
            },
            HttpStatus.NOT_FOUND,
          );
        }

        // ถ้าเครื่องจักรมีอยู่แต่ไม่มี active assignment
        const hasActiveAssignment = await this.assignOrderModel
          .findOne({
            machine_number: machineNumber,
            status: 'active',
          })
          .select('_id')
          .lean();

        if (!hasActiveAssignment) {
          throw new HttpException(
            {
              status: 'error',
              message: 'no active assignment found',
              data: [],
            },
            HttpStatus.NOT_FOUND,
          );
        }

        // ถ้ามี assignment แต่ไม่มี production order หรือ master part
        throw new HttpException(
          {
            status: 'error',
            message: 'production order or product not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const machineData = aggregationResult[0];
      const cavityValue = machineData.cavity;

      // คำนวณค่า counter
      const { counter: cycleCount, recorded_counter: remainderCount } =
        setMachineCounter(counter, cavityValue);

      // กำหนดข้อมูลที่จะอัปเดต
      const updateData = machineData.is_counter_paused
        ? {
            counter: cycleCount,
            recorded_counter: remainderCount,
            pause_start_counter: cycleCount,
          }
        : {
            counter: cycleCount,
            recorded_counter: remainderCount,
          };

      // อัปเดตข้อมูลเครื่องจักร
      const updatedMachine = await this.machineInfoModel.findOneAndUpdate(
        { machine_number: machineNumber },
        updateData,
        { new: true },
      );

      // ส่งผลลัพธ์กลับ
      return {
        status: 'success',
        message: 'Machine counter updated successfully',
        data: [updatedMachine],
      };
    } catch (error) {
      console.error('[ERROR] Error in setMachineCounter:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to set machine counter: ' + (error as Error).message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * รีเซ็ต counter ของเครื่องจักรทั้งหมด
   * @param resetType - ประเภทการรีเซ็ต ('all', 'active-only', 'inactive-only')
   * @returns ResponseFormat with reset results
   */
  async resetAllMachineCounter(
    resetType: 'all' | 'active-only' | 'inactive-only' = 'all',
  ): Promise<ResponseFormat<any>> {
    try {
      const machines = await this.machineInfoModel.find({}).exec();

      if (!machines || machines.length === 0) {
        return {
          status: 'error',
          message: 'No machines found in the system',
          data: [],
        };
      }

      const resetResults = [];
      let successCount = 0;
      let failureCount = 0;

      for (const machine of machines) {
        try {
          // ตรวจสอบว่าเครื่องจักรมี active order หรือไม่
          const activeOrder = await this.assignOrderModel
            .findOne({
              machine_number: machine.machine_number,
              status: 'active',
            })
            .exec();

          const hasActiveOrder = !!activeOrder;

          // ตรวจสอบเงื่อนไขการรีเซ็ตตาม resetType
          let shouldReset = false;
          switch (resetType) {
            case 'all':
              shouldReset = true;
              break;
            case 'active-only':
              shouldReset = hasActiveOrder;
              break;
            case 'inactive-only':
              shouldReset = !hasActiveOrder;
              break;
          }

          if (!shouldReset) {
            resetResults.push({
              machine_number: machine.machine_number,
              status: 'skipped',
              reason: `Machine does not match reset criteria (${resetType})`,
              has_active_order: hasActiveOrder,
              previous_counter: machine.counter || 0,
              previous_recorded_counter: machine.recorded_counter || 0,
            });
            continue;
          }

          // เรียกใช้ resetMachineCounter
          await this.resetMachineCounter(
            machine.machine_number,
            hasActiveOrder,
          );

          // ดึงข้อมูลเครื่องจักรหลังจากรีเซ็ต
          const updatedMachine = await this.machineInfoModel
            .findOne({
              machine_number: machine.machine_number,
            })
            .exec();

          resetResults.push({
            machine_number: machine.machine_number,
            status: 'success',
            has_active_order: hasActiveOrder,
            previous_counter: machine.counter || 0,
            previous_recorded_counter: machine.recorded_counter || 0,
            new_recorded_counter: updatedMachine?.recorded_counter || 0,
            is_counter_paused: updatedMachine?.is_counter_paused || false,
            pause_start_counter: updatedMachine?.pause_start_counter || null,
          });

          successCount++;
        } catch (error) {
          resetResults.push({
            machine_number: machine.machine_number,
            status: 'failed',
            error: (error as Error).message,
            has_active_order: false,
            previous_counter: machine.counter || 0,
            previous_recorded_counter: machine.recorded_counter || 0,
          });

          failureCount++;
          console.error(
            `Failed to reset counter for machine ${machine.machine_number}:`,
            error,
          );
        }
      }

      // สรุปผลการรีเซ็ต
      const summary = {
        total_machines: machines.length,
        success_count: successCount,
        failure_count: failureCount,
        skipped_count: resetResults.filter((r) => r.status === 'skipped')
          .length,
        reset_type: resetType,
        reset_timestamp: new Date(),
        details: resetResults,
      };

      return {
        status: failureCount === 0 ? 'success' : 'error',
        message: `Reset completed: ${successCount} success, ${failureCount} failed, ${summary.skipped_count} skipped`,
        data: [summary],
      };
    } catch (error) {
      console.error('Failed to reset all machine counters:', error);
      return {
        status: 'error',
        message: `Failed to reset machine counters: ${(error as Error).message}`,
        data: [],
      };
    }
  }
}
