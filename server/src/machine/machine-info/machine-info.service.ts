import { User } from 'src/shared/modules/schema/user.schema';
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
import { AssignEmployee } from 'src/shared/modules/schema/assign-employee.schema';
import { AssignOrder } from 'src/shared/modules/schema/assign-order.schema';
import { Employee } from 'src/shared/modules/schema/employee.schema';
import { MachineInfo } from 'src/shared/modules/schema/machine-info.schema';
import { ProductionOrder } from 'src/shared/modules/schema/production-order.schema';
import { MasterCavity } from 'src/shared/modules/schema/master-cavity.schema';
import { CreateMachineInfoDto } from '../dto/machine-info.dto';
import {
  calculateAvailableCounter,
  setMachineCounter,
} from 'src/shared/utils/counter.utils';
import { TimelineMachine } from 'src/shared/modules/schema/timeline-machine.schema';
import * as _ from 'lodash';
import { MasterPart } from 'src/shared/modules/schema/master_parts.schema';
import * as moment from 'moment-timezone';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
import { PrinterDevice } from 'src/shared/modules/schema/printer-device.schema';
import { count, error } from 'console';
import { toObjectId } from 'src/shared/utils/type.utils';
import { stat } from 'fs';

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

  async getAllMachinesDetails(): Promise<ResponseFormat<MachineInfo>> {
    try {
      const collectionNames = {
        machine: this.machineInfoModel.collection.collectionName,
        order: this.productionOrderModel.collection.collectionName,
        assignOrder: this.assignOrderModel.collection.collectionName,
        productionRecord: this.productionRecordModel.collection.collectionName,
        assignEmployee: this.assignEmployeeModel.collection.collectionName,
        employee: this.employeeModel.collection.collectionName,
        user: this.userModel.collection.collectionName,
      };

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
            ],
            as: 'production_records',
          },
        },
      ];

      const assignOrderPipeline = [
        {
          $lookup: {
            from: collectionNames.assignOrder,
            let: { orderId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$production_order_id', '$$orderId'] },
                  status: 'active',
                },
              },
              ...productionRecordPipeline,
              ...assignEmployeePipeline,
              { $project: { order_id: '$_id' } },
            ],
            as: 'assign_orders',
          },
        },
      ];

      const machines = await this.machineInfoModel.aggregate([
        {
          $lookup: {
            from: collectionNames.order,
            let: { workCenter: '$work_center' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$work_center', '$$workCenter'] },
                  sql_active: true,
                },
              },
              {
                $project: {
                  _id: 1,
                  order_id: 1,
                  order_number: 1,
                  order_type: 1,
                  basic_start_date: 1,
                  basic_finish_date: 1,
                  target_quantity: 1,
                  production_order_status: 1,
                },
              },
              ...assignOrderPipeline,
              {
                $addFields: {
                  has_assign_orders: { $gt: [{ $size: '$assign_orders' }, 0] },
                },
              },
            ],
            as: 'production_orders',
          },
        },
        {
          $addFields: {
            filtered_production_orders: {
              $filter: {
                input: '$production_orders',
                as: 'order',
                cond: { $eq: ['$$order.has_assign_orders', true] },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            machine_info: {
              machine_name: '$machine_name',
              work_center: '$work_center',
              machine_number: '$machine_number',
              line: '$line',
              status: '$status',
              counter: '$counter',
              is_counter_paused: '$is_counter_paused',
              cycle_time: '$cycletime',
              tonnage: '$tonnage',
              active_orders: '$filtered_production_orders',
              orders_count: { $size: '$filtered_production_orders' },
            },
          },
        },
      ]);

      this.createOptimalIndexes();

      return {
        status: 'success',
        message: 'All machine info retrieved successfully',
        data: machines,
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
      if (counter <= 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'counter cannot be under 0',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // ค้นหาข้อมูลเครื่องจักร
      const machine = await this.machineInfoModel
        .findOne({
          machine_number: machineNumber,
        })
        .lean();

      if (!machine) {
        throw new HttpException(
          {
            status: 'error',
            message: 'invalid machine',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ค้นหา active assignment
      const assignOrder = await this.assignOrderModel.findOne({
        machine_number: machine.machine_number,
        status: 'active',
      });

      if (!assignOrder) {
        throw new HttpException(
          {
            status: 'error',
            message: 'no active assignment found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ค้นหา production order
      const productionOrder = await this.productionOrderModel.findById(
        assignOrder.production_order_id,
      );

      if (!productionOrder) {
        throw new HttpException(
          {
            status: 'error',
            message: 'production order not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ค้นหาข้อมูลสินค้า
      const product = await this.masterPartModel.findOne({
        material_number: productionOrder.material_number,
      });

      if (!product) {
        throw new HttpException(
          {
            status: 'error',
            message: 'product not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ค้นหาข้อมูล cavity
      const cavity = await this.masterCavityModel.findOne({
        parts: { $in: [product._id.toString()] },
      });

      // กำหนดค่า cavity (ถ้าไม่มีให้ใช้ค่า default คือ 1)
      const cavityValue = cavity?.cavity || 1;

      // คำนวณค่า counter

      const { counter: cycleCount, recorded_counter: remainderCount } =
        setMachineCounter(counter, cavityValue);

      // กำหนดข้อมูลที่จะอัปเดต
      const updateData = machine.is_counter_paused
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
}
