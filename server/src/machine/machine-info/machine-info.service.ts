import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import {
  IAssignEmployee,
  IEmployee,
  IEmployeeDetail,
  IUser,
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
import { number } from 'yargs';
import { TimelineMachine } from 'src/shared/modules/schema/timeline-machine.schema';
import { time } from 'console';
import * as _ from 'lodash';
import * as moment from 'moment';

@Injectable()
export class MachineInfoService {
  constructor(
    @InjectModel(MachineInfo.name) private machineInfoModel: Model<MachineInfo>,

    @InjectModel(AssignOrder.name) private assignOrderModel: Model<AssignOrder>,

    @InjectModel(MasterCavity.name) private employeeModel: Model<Employee>,

    @InjectModel(MasterCavity.name)
    private masterCavityModel: Model<MasterCavity>,

    @InjectModel(ProductionOrder.name)
    private productionOrderModel: Model<ProductionOrder>,

    @InjectModel(AssignEmployee.name)
    private assignEmployeeModel: Model<AssignEmployee>,

    @InjectModel(TimelineMachine.name)
    private timelineMachineModel: Model<TimelineMachine>,
  ) {}

  async findByWorkCenter(work_center: string): Promise<ResponseFormat<any>> {
    try {
      // ดึงข้อมูลเครื่องจักรตาม work center
      const machine = await this.machineInfoModel
        .findOne({ work_center })
        .populate<PopulatedMachineInfo>({
          path: 'material_cavities.cavity_id',
          select: 'cavity runner parts',
        });
      if (!machine) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine not found for this work center',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ดึงข้อมูล Production Orders ที่ยังไม่ได้ assign
      const pendingOrders = await this.productionOrderModel
        .find({
          work_center,
          assign_stage: { $ne: true },
        })
        .sort({ basic_start_date: 1 });

      // ดึง active order ปัจจุบัน และ populate production_order_id
      const activeOrder = await this.assignOrderModel
        .findOne({
          machine_number: machine.machine_number,
          status: 'active',
        })
        .populate<{ production_order_id: ProductionOrder }>(
          'production_order_id',
        );

      // ดึงข้อมูลพนักงานที่กำลังทำงาน
      let activeEmployee = null;
      if (activeOrder) {
        activeEmployee = await this.assignEmployeeModel
          .findOne({
            assign_order_id: activeOrder._id,
            status: 'active',
          })
          .populate('user_id', 'employee_id first_name last_name');
      }
      const materialNumber = activeOrder?.production_order_id?.material_number;
      // เปลี่ยนจาก material_cavity_map เป็น material_cavities
      const cavityInfo = machine.material_cavities?.find(
        (mc) => mc.material_number === materialNumber,
      );
      const cavityCount = cavityInfo?.cavity_id?.cavity || 1;

      // รวมข้อมูลทั้งหมด
      const machineStatus = {
        machine_info: {
          work_center: machine.work_center,
          machine_number: machine.machine_number,
          status: machine.status,
          counter: machine.counter,
          available_counter: calculateAvailableCounter(
            machine.counter,
            machine.recorded_counter,
            cavityCount,
            machine.is_counter_paused,
            machine.pause_start_counter,
          ),
          is_counter_paused: machine.is_counter_paused,
          cycle_time: machine.cycletime,
          tonnage: machine.tonnage,
        },
        current_production: activeOrder
          ? {
              order_id: activeOrder._id,
              production_order: {
                id: activeOrder.production_order_id._id,
                order_number: (
                  activeOrder.production_order_id as ProductionOrder
                ).order_id,
                material_number: (
                  activeOrder.production_order_id as ProductionOrder
                ).material_number,
                material_description: (
                  activeOrder.production_order_id as ProductionOrder
                ).material_description,
                target_quantity: (
                  activeOrder.production_order_id as ProductionOrder
                ).target_quantity,
              },
              current_summary: activeOrder.current_summary,
              start_time: activeOrder.datetime_open_order,
            }
          : null,
        current_operator: activeEmployee
          ? {
              id: activeEmployee.user_id._id,
              employee_id: activeEmployee.user_id.employee_id,
              name: `${activeEmployee.user_id.first_name} ${activeEmployee.user_id.last_name}`,
            }
          : null,
        pending_orders: pendingOrders.map((order) => ({
          id: order._id,
          order_number: order.order_id,
          material_number: order.material_number,
          material_description: order.material_description,
          target_quantity: order.target_quantity,
          planned_start_date: order.basic_start_date,
          planned_end_date: order.basic_finish_date,
        })),
      };

      return {
        status: 'success',
        message: 'Machine and orders retrieved successfully',
        data: [machineStatus],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve machine status',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductionOrdersByWorkCenter(
    work_center: string,
    status?: 'pending' | 'active' | 'completed',
  ): Promise<ResponseFormat<any>> {
    try {
      let query: any = { work_center };

      switch (status) {
        case 'pending':
          query.assign_stage = { $ne: true };
          break;
        case 'active':
          query.assign_stage = true;
          break;
        case 'completed':
          query.assign_stage = true;
          break;
      }

      const orders = await this.productionOrderModel
        .find(query)
        .sort({ basic_start_date: 1 });

      const ordersWithStatus = await Promise.all(
        orders.map(async (order) => {
          const assignOrder = await this.assignOrderModel
            .findOne({ production_order_id: order._id })
            .sort({ datetime_open_order: -1 });

          return {
            id: order._id,
            order_number: order.order_id,
            material_number: order.material_number,
            material_description: order.material_description,
            target_quantity: order.target_quantity,
            planned_start_date: order.basic_start_date,
            planned_end_date: order.basic_finish_date,
            current_status: assignOrder ? assignOrder.status : 'pending',
            production_summary: assignOrder
              ? assignOrder.current_summary
              : null,
          };
        }),
      );

      return {
        status: 'success',
        message: 'Production orders retrieved successfully',
        data: ordersWithStatus,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve production orders',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllMachinesDetails(): Promise<ResponseFormat<any>> {
    try {
      // 1. ดึงข้อมูลเครื่องจักรทั้งหมด
      const machines = (await this.machineInfoModel
        .find()
        .populate<{
          material_cavities: {
            material_number: string;
            cavity_id: PopulatedCavityData;
          }[];
        }>({
          path: 'material_cavities.cavity_id',
          select: 'cavity runner parts',
        })
        .lean()) as PopulatedMachineInfo[];

      // 2. ดึงข้อมูลที่เกี่ยวข้องและรวมข้อมูล
      const machinesWithDetails = await Promise.all(
        machines.map(async (machine) => {
          try {
            // ดึง orders ทั้งหมดของเครื่อง
            const [allOrders, allProductionOrder, activeOrder] =
              await Promise.all([
                this.assignOrderModel.find({
                  machine_number: machine.machine_number,
                }) || [],
                this.productionOrderModel.find({
                  work_center: machine.work_center,
                  assign_stage: false,
                }) || [],
                this.assignOrderModel
                  .findOne({
                    machine_number: machine.machine_number,
                    status: 'active',
                  })
                  .populate<{ production_order_id: ProductionOrder }>(
                    'production_order_id',
                  ),
              ]);

            const materialNumber =
              activeOrder?.production_order_id?.material_number;
            const cavityInfo = machine.material_cavities?.find(
              (mc) => mc.material_number === materialNumber,
            );
            const cavityData = cavityInfo?.cavity_id;
            const cavityCount = cavityData?.cavity || 1;

            // ดึงพนักงานที่ active สำหรับ order นี้
            let activeEmployees = await this.getActiveEmployees(
              activeOrder?._id.toString(),
            );

            // ตรวจสอบว่า production_order_id มีข้อมูลหรือไม่
            const productionOrder = activeOrder?.production_order_id;

            return {
              // ข้อมูลพื้นฐานของเครื่อง
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
                  cavityCount,
                  machine.is_counter_paused,
                  machine.pause_start_counter,
                ),
                is_counter_paused: machine.is_counter_paused || false,
                cycle_time: machine.cycletime || 0,
                thonnage: machine.tonnage || 0,
              },

              // สรุปข้อมูล orders
              orders_summary: {
                total_orders: allOrders.length,
                completed_orders: allOrders.filter(
                  (o) => o?.status === 'completed',
                ).length,
                pending_orders: allOrders.filter((o) => o?.status === 'pending')
                  .length,
                waiting_assign_orders: allProductionOrder.length,
              },

              // ข้อมูล active order
              active_order:
                activeOrder && productionOrder
                  ? {
                      order_id: activeOrder._id,
                      production_order: {
                        id: productionOrder._id,
                        order_number: productionOrder.order_id,
                        material_number: productionOrder.material_number,
                        material_description:
                          productionOrder.material_description,
                        target_quantity: productionOrder.target_quantity,
                        taget_daly: productionOrder.plan_target_day,
                        plan_cycle_time: productionOrder.plan_cycle_time,
                        weight: cavityData?.parts?.[0]?.weight || 0,
                        weight_runner: cavityData?.runner || 0,
                      },
                      production_summary: {
                        ...(activeOrder.current_summary || {}),
                        achievement_rate: this.calculateAchievementRate(
                          activeOrder.current_summary?.total_good_quantity || 0,
                          productionOrder.target_quantity || 0,
                        ),
                      },
                    }
                  : null,

              // ข้อมูลพนักงานที่ active
              active_employees: {
                count: activeEmployees.length,
                details: activeEmployees,
              },

              // ข้อมูลการผลิตล่าสุด
              latest_production: activeOrder?.datetime_open_order
                ? {
                    start_time: activeOrder.datetime_open_order,
                    running_time: this.calculateRunningTime(
                      activeOrder.datetime_open_order,
                    ),
                    efficiency: this.calculateEfficiency(
                      activeOrder.current_summary?.total_good_quantity || 0,
                      new Date(activeOrder.datetime_open_order).getTime(),
                      Number(machine.cycletime) || 0,
                      machine.is_counter_paused,
                    ),
                  }
                : null,
            };
          } catch (error) {
            console.error(
              `Error processing machine ${machine.machine_number}:`,
              error,
            );
            // Return minimal machine info if there's an error processing details

            return {
              machine_info: {
                work_center: machine.work_center || '',
                machine_number: machine.machine_number || '',
                line: machine.line || '',
                status: 'error',
                counter: 0,
                cycle_time: 0,
              },
              orders_summary: {
                total_orders: 0,
                completed_orders: 0,
                pending_orders: 0,
              },
              active_order: null,
              active_employees: { count: 0, details: [] },
              latest_production: null,
            };
          }
        }),
      );

      return {
        status: 'success',
        message: 'Machines details retrieved successfully',
        data: machinesWithDetails,
      };
    } catch (error) {
      console.error('Error in getAllMachinesDetails:', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        timestamp: new Date().toISOString(),
        context: 'MachineService.getAllMachinesDetails',
      });

      if (error instanceof HttpException) throw error;

      const errorDetails = {
        message: (error as Error).message || 'Unknown error',
        code: (error as any).code,
        name: (error as Error).name,
      };

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve machines details',
          data: [errorDetails],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
          name:
            employeeData.first_name && employeeData.last_name
              ? `${employeeData.first_name} ${employeeData.last_name}`.trim()
              : 'N/A',
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

  private parseTimelineDate(dateString: string): Date {
    try {
      const [datePart, timePart] = dateString.split(' ');
      const [month, day, year] = datePart.split('/');
      let [hours, minutes, seconds] = timePart.split(':');

      // Handle missing seconds
      if (!seconds) seconds = '0';

      // Parse all values as integers
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds),
      );
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
      return new Date(dateString);
    }
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

      // ใช้ aggregation pipeline เพื่อคำนวณ summary ใน MongoDB
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
          $group: {
            _id: {
              machine_number: '$machine_number',
              status: '$status',
              timeSlot: {
                $subtract: [
                  {
                    $divide: [
                      {
                        $subtract: [
                          { $toDate: '$datetime' },
                          new Date(startString),
                        ],
                      },
                      1000 * 60 * intervalMinutes,
                    ],
                  },
                  {
                    $mod: [
                      {
                        $divide: [
                          {
                            $subtract: [
                              { $toDate: '$datetime' },
                              new Date(startString),
                            ],
                          },
                          1000 * 60 * intervalMinutes,
                        ],
                      },
                      1,
                    ],
                  },
                ],
              },
            },
            count: { $sum: 1 },
            first_datetime: { $min: '$datetime' },
            last_datetime: { $max: '$datetime' },
          },
        },
        {
          $group: {
            _id: {
              machine_number: '$_id.machine_number',
              timeSlot: '$_id.timeSlot',
            },
            statuses: {
              $push: {
                status: '$_id.status',
                count: '$count',
                first_datetime: '$first_datetime',
                last_datetime: '$last_datetime',
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.machine_number',
            time_slots: {
              $push: {
                slot_number: '$_id.timeSlot',
                statuses: '$statuses',
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // แปลงผลลัพธ์เป็นรูปแบบที่ต้องการ
      const machineAnalysis = timelineAggregation.map((machineData) => {
        const machine_number = machineData._id;
        const totalDuration = end.getTime() - start.getTime();

        // คำนวณ total summary
        const statusSummary = {};
        machineData.time_slots.forEach((slot) => {
          slot.statuses.forEach((status) => {
            if (!statusSummary[status.status]) {
              statusSummary[status.status] = {
                count: 0,
                duration: 0,
              };
            }
            statusSummary[status.status].count += status.count;
            statusSummary[status.status].duration +=
              new Date(status.last_datetime).getTime() -
              new Date(status.first_datetime).getTime();
          });
        });

        // แปลงเป็นเปอร์เซ็นต์
        const total_summary = {};
        Object.entries(statusSummary).forEach(([status, data]) => {
          total_summary[status] = {
            percentage: Number(
              (
                ((data as { duration: number }).duration / totalDuration) *
                100
              ).toFixed(2),
            ),
            duration_minutes: Number(
              ((data as { duration: number }).duration / (1000 * 60)).toFixed(
                2,
              ),
            ),
            duration_hours: Number(
              (
                (data as { duration: number }).duration /
                (1000 * 60 * 60)
              ).toFixed(2),
            ),
          };
        });

        return {
          machine_number,
          total_summary,
          time_slots: machineData.time_slots
            .sort((a, b) => a.slot_number - b.slot_number)
            .map((slot) => {
              const slotStart = new Date(
                start.getTime() +
                  slot.slot_number * intervalMinutes * 60 * 1000,
              );
              const slotEnd = new Date(
                Math.min(
                  slotStart.getTime() + intervalMinutes * 60 * 1000,
                  end.getTime(),
                ),
              );

              return {
                start_time: slotStart,
                end_time: slotEnd,
                status_summary: this.calculateSlotSummary(
                  slot.statuses,
                  slotStart,
                  slotEnd,
                ),
              };
            }),
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

  // เพิ่มเมธอดสำหรับคำนวณสรุปรวม
  private calculateTotalStatusDuration(
    timelines: any[],
    startTime: Date,
    endTime: Date,
  ) {
    const statusMap = new Map<string, number>();
    const totalDuration = endTime.getTime() - startTime.getTime();

    if (timelines.length === 0) {
      return {
        UNKNOWN: {
          percentage: 100,
          duration_minutes: totalDuration / (1000 * 60),
          duration_hours: (totalDuration / (1000 * 60 * 60)).toFixed(2),
        },
      };
    }

    for (let i = 0; i < timelines.length; i++) {
      const current = timelines[i];
      const next = timelines[i + 1];

      // แปลง datetime string เป็น Date object
      const currentDate = this.parseTimelineDate(current.datetime);
      const nextDate = next ? this.parseTimelineDate(next.datetime) : endTime;
      const previousDate =
        i === 0 ? startTime : this.parseTimelineDate(current.datetime);

      const duration = nextDate.getTime() - previousDate.getTime();

      statusMap.set(
        current.status,
        (statusMap.get(current.status) || 0) + duration,
      );
    }

    const result = {};
    statusMap.forEach((duration, status) => {
      result[status] = {
        percentage: Number(((duration / totalDuration) * 100).toFixed(2)),
        duration_minutes: Number((duration / (1000 * 60)).toFixed(2)),
        duration_hours: Number((duration / (1000 * 60 * 60)).toFixed(2)),
      };
    });

    return result;
  }

  private calculateStatusDuration(
    timelines: any[],
    startTime: Date,
    endTime: Date,
  ) {
    const statusMap = new Map<string, number>();
    const totalDuration = endTime.getTime() - startTime.getTime();

    if (timelines.length === 0) {
      return {
        UNKNOWN: {
          percentage: 100,
          duration_minutes: totalDuration / (1000 * 60),
        },
      };
    }

    // คำนวณระยะเวลาของแต่ละ status
    for (let i = 0; i < timelines.length; i++) {
      const current = timelines[i];
      const next = timelines[i + 1];

      // แปลง datetime string เป็น Date object
      const currentDate = this.parseTimelineDate(current.datetime);
      const nextDate = next ? this.parseTimelineDate(next.datetime) : endTime;
      const previousDate =
        i === 0 ? startTime : this.parseTimelineDate(current.datetime);

      const duration = nextDate.getTime() - previousDate.getTime();

      statusMap.set(
        current.status,
        (statusMap.get(current.status) || 0) + duration,
      );
    }

    // แปลงเป็นเปอร์เซ็นต์
    const result = {};
    statusMap.forEach((duration, status) => {
      result[status] = {
        percentage: Number(((duration / totalDuration) * 100).toFixed(2)),
        duration_minutes: Number((duration / (1000 * 60)).toFixed(2)),
      };
    });

    return result;
  }
}
