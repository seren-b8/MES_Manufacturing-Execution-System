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
} from 'src/shared/interface/machine-info';
import { AssignEmployee } from 'src/shared/modules/schema/assign-employee.schema';
import { AssignOrder } from 'src/shared/modules/schema/assign-order.schema';
import { Employee } from 'src/shared/modules/schema/employee.schema';
import { MachineInfo } from 'src/shared/modules/schema/machine-info.schema';
import { ProductionOrder } from 'src/shared/modules/schema/production-order.schema';
import { MasterCavity } from 'src/shared/modules/schema/master-cavity.schema';
import { CreateMachineInfoDto } from '../dto/machine-info.dto';
import { calculateAvailableCounter } from 'src/shared/utils/counter.utils';
import { TimelineMachine } from 'src/shared/modules/schema/timeline-machine.schema';
import * as _ from 'lodash';
import { MasterPart } from 'src/shared/modules/schema/master_parts.schema';
import * as moment from 'moment-timezone';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
import { PrinterDevice } from 'src/shared/modules/schema/printer-device.schema';

@Injectable()
export class MachineInfoService {
  constructor(
    @InjectModel(MachineInfo.name) private machineInfoModel: Model<MachineInfo>,

    @InjectModel(PrinterDevice.name)
    private readonly printerDeviceModel: Model<PrinterDevice>,

    @InjectModel(AssignOrder.name) private assignOrderModel: Model<AssignOrder>,

    @InjectModel(Employee.name) private employeeModel: Model<Employee>,

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

  async getAllMachinesDetails(): Promise<ResponseFormat<any>> {
    try {
      const machines = await this.machineInfoModel.find().lean();

      const machinesWithDetails = await Promise.all(
        machines.map(async (machine) => {
          try {
            const activeOrders = await this.getActiveOrdersData(machine);
            const primaryActiveOrder =
              activeOrders.length > 0 ? activeOrders[0] : null;
            // ดึงข้อมูลพื้นฐาน
            const [allOrders, allProductionOrder] = await Promise.all([
              this.assignOrderModel.find({
                machine_number: machine.machine_number,
              }),
              this.productionOrderModel.find({
                work_center: machine.work_center,
                assign_stage: false,
              }),
            ]);

            // ดึงข้อมูล daily summary สำหรับทุก active order
            let consolidatedSummary = {
              total_quantity: 0,
              good_quantity: 0,
              not_good_quantity: 0,
            };

            if (activeOrders.length > 0) {
              const dailySummaries = await Promise.all(
                activeOrders.map((order) =>
                  this.getDailySummary(order.order_id.toString()),
                ),
              );

              // รวมข้อมูลจากทุก order
              dailySummaries.forEach((summary) => {
                if (summary?.data[0]) {
                  consolidatedSummary.total_quantity +=
                    summary.data[0].total_quantity || 0;
                  consolidatedSummary.good_quantity +=
                    summary.data[0].good_quantity || 0;
                  consolidatedSummary.not_good_quantity +=
                    summary.data[0].not_good_quantity || 0;
                }
              });
            }

            // ดึงข้อมูล cavity และ part จาก primary order (ถ้ามี)
            const { cavityData, partData } = primaryActiveOrder
              ? await this.getCavityAndPartData(
                  primaryActiveOrder.production_order.material_number,
                )
              : { cavityData: null, partData: null };

            // ดึงข้อมูลพนักงานจากทุก active order
            // const activeEmployees =
            //   await this.getActiveEmployeesFromOrders(activeOrders);

            return {
              machine_info: {
                machine_name: machine.machine_name || '',
                work_center: machine.work_center || '',
                machine_number: machine.machine_number || '',
                line: machine.line || '',
                status: machine.status || 'unknown',
                counter: machine.counter,
                available_counter: calculateAvailableCounter(
                  machine.counter,
                  machine.recorded_counter,
                  cavityData?.cavity || 1,
                  machine.is_counter_paused,
                  machine.pause_start_counter,
                ),
                cavity_info: cavityData
                  ? {
                      cavity_count: cavityData.cavity,
                      runner: cavityData.runner,
                      part_info: partData
                        ? {
                            material_number: partData.material_number,
                            part_number: partData.part_number,
                            part_name: partData.part_name,
                            weight: partData.weight,
                          }
                        : null,
                    }
                  : null,
                is_counter_paused: machine.is_counter_paused || false,
                cycle_time: machine.cycletime || 0,
                tonnage: machine.tonnage || 0,
              },
              orders_summary: {
                total_orders: allOrders.length,
                completed_orders: allOrders.filter(
                  (o) => o?.status === 'completed',
                ).length,
                suspended_orders: allOrders.filter(
                  (o) => o?.status === 'suspended',
                ).length,
                waiting_assign_orders: allProductionOrder.length,
              },
              active_orders: activeOrders, // เปลี่ยนจาก active_order เป็น active_orders
              // daily_total_quantity: consolidatedSummary.total_quantity,
              // daily_good_quantity: consolidatedSummary.good_quantity,
              // daily_not_good_quantity: consolidatedSummary.not_good_quantity,
            };
          } catch (error) {
            console.error(
              `Error processing machine ${machine.machine_number}:`,
              error,
            );
            return this.getErrorMachineData(machine);
          }
        }),
      );

      return {
        status: 'success',
        message: 'Machines details retrieved successfully',
        data: machinesWithDetails,
      };
    } catch (error) {
      return this.handleServiceError(error);
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
          updated_at: new Date(),
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
            updated_at: new Date(),
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
          printer_id: new Types.ObjectId(printerId),
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
    orderId: string,
  ): Promise<ResponseFormat<DailySummaryData>> {
    try {
      const orderObjectId = new Types.ObjectId(orderId);

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

  private calculateAchievementRate(
    totalGood: number,
    targetQuantity: number,
  ): number {
    if (!targetQuantity) return 0;
    return Math.round((totalGood / targetQuantity) * 10000) / 100; // Round to 2 decimal places
  }

  private calculateRunningTime(startTime: Date): number {
    return Math.floor(
      (new Date().getTime() - new Date(startTime).getTime()) / (1000 * 60),
    );
  }

  private calculateEfficiency(
    totalGood: number,
    startTime: number,
    cycleTime: number,
    isPaused: boolean,
  ): number {
    if (!cycleTime || isPaused) return 0;
    const runningTimeInSeconds =
      (new Date().getTime() - new Date(startTime).getTime()) / 1000;
    const theoreticalOutput = runningTimeInSeconds / cycleTime;
    if (!theoreticalOutput) return 0;
    const efficiency = (totalGood / theoreticalOutput) * 100;
    return Math.round(efficiency * 100) / 100; // Round to 2 decimal places
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

  private getErrorMachineData(machine: any) {
    return {
      machine_info: {
        work_center: machine.work_center || '',
        machine_number: machine.machine_number || '',
        line: machine.line || '',
        status: 'error',
        counter: 0,
        cycle_time: 0,
        cavity_info: null,
      },
      orders_summary: {
        total_orders: 0,
        completed_orders: 0,
        pending_orders: 0,
        waiting_assign_orders: 0,
      },
      active_order: null,
      active_employees: { count: 0, details: [] },
      latest_production: null,
    };
  }

  private handleServiceError(error: any): never {
    console.error('Service error:', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      timestamp: new Date().toISOString(),
    });

    if (error instanceof HttpException) throw error;

    throw new HttpException(
      {
        status: 'error',
        message: 'Failed to retrieve machines details',
        data: [
          {
            message: (error as Error).message || 'Unknown error',
            code: (error as any).code,
            name: (error as Error).name,
          },
        ],
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private async getActiveEmployeesFromOrders(
    activeOrders: any[],
  ): Promise<IEmployeeDetail[]> {
    if (!activeOrders?.length) {
      console.log('No active orders found, returning empty employee list');
      return [];
    }

    try {
      // รวบรวม order IDs จากทุก active order
      const orderIds = activeOrders.map((order) => order.order_id.toString());
      console.log('Order IDs for employee lookup:', orderIds);

      // แก้ไขบัค: ไม่ควรใช้ toString() กับอาร์เรย์ แต่ควรส่ง orderIds โดยตรง
      const assignEmployees = await this.assignEmployeeModel
        .find({
          assign_order_id: { $in: orderIds },
          status: 'active',
        })
        .populate<{ user_id: IUser }>('user_id')
        .lean();

      console.log('Found assign employees:', assignEmployees.length);

      if (assignEmployees.length === 0) {
        console.log('No active employee assignments found for these orders');
        return [];
      }

      // ดึงรายการ employee IDs ที่ unique
      const employeeIds = Array.from(
        new Set(
          assignEmployees
            .map((assign) => {
              console.log('User_id data:', assign.user_id);
              return assign.user_id?.employee_id;
            })
            .filter((id): id is string => !!id),
        ),
      );

      console.log('Employee IDs for lookup:', employeeIds);

      // ดึงข้อมูลพนักงาน
      const employees = await this.employeeModel
        .find<IEmployee>({ employee_id: { $in: employeeIds } })
        .lean();

      console.log('Found employees:', employees.length);

      // สร้างรายละเอียดพนักงาน
      const result = assignEmployees.map((assign): IEmployeeDetail => {
        const userData = assign.user_id || ({} as IUser);
        const employeeData =
          employees.find((emp) => emp.employee_id === userData.employee_id) ||
          ({} as IEmployee);

        console.log('Mapping employee:', {
          userId: userData._id?.toString(),
          employeeId: userData.employee_id,
          firstName: employeeData.first_name,
          lastName: employeeData.last_name,
        });

        return {
          id: userData._id?.toString() || '',
          employee_id: userData.employee_id || '',
          name: `${employeeData.first_name || ''} ${employeeData.last_name || ''}`.trim(),
        };
      });

      console.log('Final employee details:', result.length);
      return result; // เพิ่ม return statement ที่ขาดหายไป
    } catch (error) {
      console.error('Error fetching active employees from orders:', error);
      return [];
    }
  }

  private async getCavityAndPartData(
    materialNumber: string,
  ): Promise<CavityAndPartResult> {
    if (!materialNumber) {
      return { cavityData: null, partData: null };
    }

    try {
      // 1. ค้นหาแบบแยก query เพื่อง่ายต่อการ debug
      const cavity = await this.masterCavityModel
        .findOne()
        .populate({
          path: 'parts',
          model: 'MasterPart',
          match: { material_number: materialNumber },
          select: 'material_number part_number part_name weight',
        })
        .lean();

      // Debug logs

      if (!cavity) {
        return { cavityData: null, partData: null };
      }

      if (!cavity.parts || cavity.parts.length === 0) {
        return { cavityData: null, partData: null };
      }

      // 2. ถ้าไม่พบข้อมูล ลองค้นหาโดยตรงจาก MasterPart
      if (!cavity.parts.length) {
        const part = await this.masterPartModel
          .findOne({ material_number: materialNumber })
          .lean();

        if (part) {
          // ค้นหา cavity ที่มี part นี้
          const cavityWithPart = await this.masterCavityModel
            .findOne({ parts: part._id })
            .lean();

          if (cavityWithPart) {
            return {
              cavityData: {
                cavity: cavityWithPart.cavity,
                runner: cavityWithPart.runner,
                tonnage: cavityWithPart.tonnage,
              },
              partData: part,
            };
          }
        }
      }

      // 3. ถ้าพบข้อมูลปกติ
      return {
        cavityData: {
          cavity: cavity.cavity,
          runner: cavity.runner,
          tonnage: cavity.tonnage,
        },
        partData: cavity.parts[0],
      };
    } catch (error) {
      console.error('Error getting cavity and part data:', error);
      // Log detailed error information
      console.error('Error details:', {
        materialNumber,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
      });
      return { cavityData: null, partData: null };
    }
  }

  // 2. แยกฟังก์ชันดึงข้อมูล active order
  private async getActiveOrdersData(machine: any) {
    try {
      // ดึงข้อมูล active orders
      const activeOrders = await this.assignOrderModel
        .find({
          machine_number: machine.machine_number,
          status: 'active',
        })
        .populate<{ production_order_id: ProductionOrder }>(
          'production_order_id',
        )
        .lean();

      if (!activeOrders?.length) return [];

      // เตรียมข้อมูลเบื้องต้น
      const orderIds = activeOrders.map((order) => order._id);

      // สร้าง orders พร้อมรายละเอียด
      const ordersWithBasicDetails = await Promise.all(
        activeOrders.map(async (activeOrder) => {
          if (!activeOrder?.production_order_id) return null;

          const { cavityData, partData } = await this.getCavityAndPartData(
            activeOrder.production_order_id.material_number,
          );

          return {
            order_id: activeOrder._id,
            production_order: {
              id: activeOrder.production_order_id._id,
              order_number: activeOrder.production_order_id.order_id,
              material_number: activeOrder.production_order_id.material_number,
              material_description:
                activeOrder.production_order_id.material_description,
              target_quantity: activeOrder.production_order_id.target_quantity,
              target_daily: activeOrder.production_order_id.plan_target_day,
              plan_cycle_time: activeOrder.production_order_id.plan_cycle_time,
              part_info: partData
                ? {
                    weight: (partData as any).weight,
                    weight_runner: cavityData?.runner || 0,
                  }
                : null,
            },
            production_summary: {
              ...(activeOrder.current_summary || {}),
              achievement_rate: this.calculateAchievementRate(
                activeOrder.current_summary?.total_good_quantity || 0,
                activeOrder.production_order_id.target_quantity || 0,
              ),
            },
            datetime_open_order: activeOrder.datetime_open_order,
          };
        }),
      );

      // กรอง orders ที่เป็น null ออก
      const filteredOrders = ordersWithBasicDetails.filter(Boolean);

      // ดึงข้อมูลสรุปรายวันสำหรับแต่ละ order
      const ordersWithDailySummary = await Promise.all(
        filteredOrders.map(async (order) => {
          // เรียกใช้ getDailySummary เพื่อดึงข้อมูลสรุปรายวัน
          const dailySummary = await this.getDailySummary(
            order.order_id.toString(),
          );

          const summaryData = dailySummary?.data?.[0];

          // เพิ่มข้อมูลสรุปรายวันเข้าไปใน order object
          return {
            ...order,
            daily_summary: {
              total_quantity: summaryData.total_quantity ?? 0,
              good_quantity: summaryData.good_quantity ?? 0,
              not_good_quantity: summaryData.not_good_quantity ?? 0,
            },
          };
        }),
      );

      // ดึงข้อมูลพนักงานสำหรับแต่ละ order ผ่านฟังก์ชัน getActiveEmployeesFromOrders
      // โดยสร้าง structure แบบเดียวกับที่ getActiveEmployeesFromOrders ต้องการ
      const orderWithEmployeeInfos = await Promise.all(
        ordersWithDailySummary.map(async (order) => {
          // เรียกใช้ getActiveEmployeesFromOrders สำหรับ order เดียว
          const employees = await this.getActiveEmployeesFromOrders([
            {
              order_id: order.order_id,
            },
          ]);

          // เพิ่มข้อมูลพนักงานเข้าไปใน order object
          return {
            ...order,
            employees: employees || [],
          };
        }),
      );

      return orderWithEmployeeInfos;
    } catch (error) {
      console.error('Error getting active orders data:', error);
      return [];
    }
  }
}
