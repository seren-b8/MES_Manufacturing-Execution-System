import {
  Injectable,
  HttpException,
  HttpStatus,
  ConsoleLogger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import {
  CavityAndPartResult,
  CavityData,
  DailySummaryData,
  IEmployee,
  IEmployeeDetail,
  IUser,
  MachineDetailResponse,
  PartData,
  PopulatedCavityData,
  PopulatedMachineInfo,
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
import { ProductionRecordService } from 'src/production/production-reccord/production-reccord.service';
import * as moment from 'moment';
import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';

@Injectable()
export class MachineInfoService {
  constructor(
    @InjectModel(MachineInfo.name) private machineInfoModel: Model<MachineInfo>,

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
            const activeOrder = await this.getActiveOrderData(machine);
            // ดึงข้อมูลพื้นฐาน
            const [allOrders, allProductionOrder, dailySummary] =
              await Promise.all([
                this.assignOrderModel.find({
                  machine_number: machine.machine_number,
                }),
                this.productionOrderModel.find({
                  work_center: machine.work_center,
                  assign_stage: false,
                }),
                activeOrder
                  ? this.getDailySummary(activeOrder.order_id.toString())
                  : null,
              ]);

            // ดึงข้อมูล cavity และ part
            const { cavityData, partData } = activeOrder
              ? await this.getCavityAndPartData(
                  activeOrder.production_order.material_number,
                )
              : { cavityData: null, partData: null };

            // ดึงข้อมูลพนักงาน
            const activeEmployees = await this.getActiveEmployees(
              activeOrder?.order_id.toString(),
            );

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
                pending_orders: allOrders.filter((o) => o?.status === 'pending')
                  .length,
                waiting_assign_orders: allProductionOrder.length,
              },
              active_order: activeOrder,
              active_employees: {
                count: activeEmployees.length,
                details: activeEmployees,
              },
              latest_production: activeOrder?.datetime_open_order
                ? {
                    start_time: activeOrder.datetime_open_order,
                    running_time: this.calculateRunningTime(
                      activeOrder.datetime_open_order,
                    ),
                    efficiency: this.calculateEfficiency(
                      activeOrder.production_summary.total_good_quantity || 0,
                      new Date(activeOrder.datetime_open_order).getTime(),
                      Number(machine.cycletime) || 0,
                      machine.is_counter_paused,
                    ),
                    daily_summary: dailySummary?.data || [],
                  }
                : null,
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

  async getDailySummary(orderId: string): Promise<ResponseFormat<any>> {
    try {
      const orderObjectId = new Types.ObjectId(orderId);

      // Get AssignOrder data for validation
      const assignOrder = await this.assignOrderModel.findById(orderObjectId);
      if (!assignOrder) {
        throw new Error('Order not found');
      }

      // Get start date from order's datetime_open_order
      const startDate = moment(assignOrder.datetime_open_order);

      // Adjust to nearest 8:00 AM backward
      const adjustedStartDate = moment(startDate)
        .startOf('day')
        .add(8, 'hours');

      if (startDate.hour() < 8) {
        adjustedStartDate.subtract(1, 'day');
      }

      // Create array of date ranges
      const dateRanges = [];
      const currentDate = moment();
      let currentRange = moment(adjustedStartDate);

      while (currentRange.isBefore(currentDate)) {
        dateRanges.push({
          start: moment(currentRange),
          end: moment(currentRange).add(1, 'day'),
        });
        currentRange.add(1, 'day');
      }

      // Get production records for each date range
      const dailySummaries = await Promise.all(
        dateRanges.map(async (range) => {
          // Find all production records within the time range
          const records = await this.productionRecordModel
            .find({
              assign_order_id: orderObjectId,
              createdAt: {
                $gte: range.start.toDate(),
                $lt: range.end.toDate(),
              },
            })
            .lean();

          // Initialize summary with just quantity data
          const summary = {
            date: range.start.format('YYYY-MM-DD'),
            total_quantity: 0,
            good_quantity: 0,
            not_good_quantity: 0,
          };

          // Process records
          records.forEach((record) => {
            const quantity = record.quantity || 0;
            summary.total_quantity += quantity;

            if (record.is_not_good) {
              summary.not_good_quantity += quantity;
            } else {
              summary.good_quantity += quantity;
            }
          });

          return summary;
        }),
      );

      return {
        status: 'success',
        message: 'Daily production summaries retrieved successfully',
        data: dailySummaries,
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

      const updatedMachine = await this.machineInfoModel.findOneAndUpdate(
        { machine_number: machineNumber },
        {
          recorded_counter: 0,
          is_counter_paused: true,
          pause_start_counter: 0,
        },
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

  private async getActiveEmployees(
    assignOrderId?: string,
  ): Promise<IEmployeeDetail[]> {
    if (!assignOrderId) return [];

    try {
      const assignEmployees = await this.assignEmployeeModel
        .find({
          assign_order_id: assignOrderId,
          status: 'active',
        })
        .populate<{ user_id: IUser }>('user_id')
        .lean();

      const employeeIds = assignEmployees
        .map((assign) => assign.user_id?.employee_id)
        .filter((id): id is string => !!id);

      const employees = await this.employeeModel
        .find<IEmployee>({ employee_id: { $in: employeeIds } })
        .lean();

      return assignEmployees.map((assign): IEmployeeDetail => {
        const userData = assign.user_id || ({} as IUser);
        const employeeData =
          employees.find((emp) => emp.employee_id === userData.employee_id) ||
          ({} as IEmployee);

        return {
          id: userData._id.toString() || '',
          employee_id: userData.employee_id || '',
          name: `${employeeData.first_name} ${employeeData.last_name}`.trim(),
        };
      });
    } catch (error) {
      console.error('Error fetching active employees:', error);
      return [];
    }
  }

  private formatDateToString(date: Date): string {
    const month = (date.getMonth() + 1).toString(); // ไม่ต้อง pad
    const day = date.getDate().toString(); // ไม่ต้อง pad
    const year = date.getFullYear();
    const hours = date.getHours().toString(); // ไม่ต้อง pad
    const minutes = date.getMinutes().toString(); // ไม่ต้อง pad
    const seconds = date.getSeconds().toString(); // ไม่ต้อง pad

    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
  }

  async getMachineStatusByPeriod(
    startDate: Date,
    endDate: Date,
    intervalMinutes: number = 10,
    machineNumbers?: string[],
  ): Promise<ResponseFormat<any>> {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const startString = this.formatDateToString(start);
      const endString = this.formatDateToString(end);

      const timelineAggregation = await this.timelineMachineModel.aggregate([
        {
          $match: {
            machine_number: machineNumbers?.length
              ? { $in: machineNumbers }
              : { $exists: true },
            datetime: {
              $gte: startString,
              $lte: endString,
            },
          },
        },
        {
          // Calculate interval start time for each record
          $addFields: {
            interval_start: {
              $dateFromParts: {
                year: { $year: { $toDate: '$datetime' } },
                month: { $month: { $toDate: '$datetime' } },
                day: { $dayOfMonth: { $toDate: '$datetime' } },
                hour: { $hour: { $toDate: '$datetime' } },
                minute: {
                  $multiply: [
                    {
                      $floor: {
                        $divide: [
                          { $minute: { $toDate: '$datetime' } },
                          intervalMinutes,
                        ],
                      },
                    },
                    intervalMinutes,
                  ],
                },
              },
            },
          },
        },
        {
          $group: {
            _id: {
              machine_number: '$machine_number',
              status: '$status',
              interval_start: '$interval_start',
            },
            duration: {
              $sum: {
                $min: [
                  {
                    $dateDiff: {
                      startDate: { $toDate: '$datetime' },
                      endDate: {
                        $min: [
                          {
                            $toDate: { $ifNull: ['$next_datetime', endString] },
                          },
                          {
                            $dateAdd: {
                              startDate: '$interval_start',
                              unit: 'minute',
                              amount: intervalMinutes,
                            },
                          },
                        ],
                      },
                      unit: 'minute',
                    },
                  },
                  intervalMinutes,
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: {
              machine_number: '$_id.machine_number',
              interval_start: '$_id.interval_start',
            },
            status_durations: {
              $push: {
                status: '$_id.status',
                duration: '$duration',
              },
            },
          },
        },
        {
          $sort: {
            '_id.machine_number': 1,
            '_id.interval_start': 1,
          },
        },
        {
          $group: {
            _id: '$_id.machine_number',
            intervals: {
              $push: {
                start_time: '$_id.interval_start',
                status_durations: '$status_durations',
              },
            },
          },
        },
      ]);

      const machineAnalysis = timelineAggregation.map((machineData) => {
        const intervals = machineData.intervals.map((interval) => {
          const timeline = {
            start_time: interval.start_time,
          };

          // Initialize all statuses to 0
          const allStatuses = new Set<string>(
            interval.status_durations.map((sd) => sd.status),
          );
          allStatuses.forEach((status: string) => {
            timeline[status as keyof typeof timeline] = 0;
          });

          // Add duration for each status
          interval.status_durations.forEach((statusData) => {
            timeline[statusData.status] = statusData.duration;
          });

          return timeline;
        });

        return {
          machine_number: machineData._id,
          intervals,
        };
      });

      return {
        status: 'success',
        message: 'Retrieved machine status analysis successfully',
        data: machineAnalysis,
      };
    } catch (error) {
      console.error('Error in getMachineStatusByPeriod:', error);
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to analyze machine status',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private calculateSlotSummary(
    statuses: any[],
    slotStart: Date,
    slotEnd: Date,
  ) {
    const statusMap = new Map<string, number>();
    const totalDuration = slotEnd.getTime() - slotStart.getTime();

    statuses.forEach((status) => {
      const duration =
        new Date(status.last_datetime).getTime() -
        new Date(status.first_datetime).getTime();
      statusMap.set(
        status.status,
        (statusMap.get(status.status) || 0) + duration,
      );
    });

    const result = {};
    statusMap.forEach((duration, status) => {
      result[status] = {
        percentage: Number(((duration / totalDuration) * 100).toFixed(2)),
        duration_minutes: Number((duration / (1000 * 60)).toFixed(2)),
      };
    });

    return result;
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
        console.log('No cavity found:', materialNumber);
        return { cavityData: null, partData: null };
      }

      if (!cavity.parts || cavity.parts.length === 0) {
        // console.log('Cavity found but no matching parts');
        // console.log('Cavity ID:', cavity._id);
        return { cavityData: null, partData: null };
      }

      // 2. ถ้าไม่พบข้อมูล ลองค้นหาโดยตรงจาก MasterPart
      if (!cavity.parts.length) {
        console.log('Trying direct part query');
        const part = await this.masterPartModel
          .findOne({ material_number: materialNumber })
          .lean();

        if (part) {
          console.log('Found part directly:', part);
          // ค้นหา cavity ที่มี part นี้
          const cavityWithPart = await this.masterCavityModel
            .findOne({ parts: part._id })
            .lean();

          if (cavityWithPart) {
            console.log('Found cavity through part:', cavityWithPart);
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
  private async getActiveOrderData(machine: any) {
    try {
      const activeOrder = await this.assignOrderModel
        .findOne({
          machine_number: machine.machine_number,
          status: 'active',
        })
        .populate<{ production_order_id: ProductionOrder }>(
          'production_order_id',
        )
        .lean();

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
    } catch (error) {
      console.error('Error getting active order data:', error);
      return null;
    }
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
}
