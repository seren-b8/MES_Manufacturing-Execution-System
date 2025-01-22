import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import {
  IAssignEmployee,
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

@Injectable()
export class MachineInfoService {
  constructor(
    @InjectModel('MachineInfo') private machineInfoModel: Model<MachineInfo>,
    @InjectModel('ProductionOrder')
    private productionOrderModel: Model<ProductionOrder>,
    @InjectModel('AssignOrder') private assignOrderModel: Model<AssignOrder>,
    @InjectModel('AssignEmployee')
    private assignEmployeeModel: Model<AssignEmployee>,
    @InjectModel('Employee') private employeeModel: Model<Employee>,
    @InjectModel('MasterCavity') private masterCavityModel: Model<MasterCavity>,
  ) {}

  async findByWorkCenter(work_center: string): Promise<ResponseFormat<any>> {
    try {
      // ดึงข้อมูลเครื่องจักรตาม work center
      const machine = await this.machineInfoModel.findOne({ work_center });
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

      // รวมข้อมูลทั้งหมด
      const machineStatus = {
        machine_info: {
          work_center: machine.work_center,
          machine_number: machine.machine_number,
          status: machine.status,
          counter: machine.counter,
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
      const machines = await this.machineInfoModel.find().lean();

      // 2. ดึงข้อมูลที่เกี่ยวข้องและรวมข้อมูล
      const machinesWithDetails = await Promise.all(
        machines.map(async (machine) => {
          try {
            // ดึง orders ทั้งหมดของเครื่อง
            const allOrders =
              (await this.assignOrderModel.find({
                machine_number: machine.machine_number,
              })) || [];

            const allProductionOrder =
              (await this.productionOrderModel.find({
                work_center: machine.work_center,
                assign_stage: false,
              })) || [];

            // หา active order
            const activeOrder = await this.assignOrderModel
              .findOne({
                machine_number: machine.machine_number,
                status: 'active',
              })
              .populate<{ production_order_id: ProductionOrder }>(
                'production_order_id',
              );

            const cavity = await this.masterCavityModel.findOne({
              material_number:
                activeOrder?.production_order_id?.material_number,
            });

            // ดึงพนักงานที่ active สำหรับ order นี้
            let activeEmployees: IEmployeeDetail[] = []; // เปลี่ยน type ให้ถูกต้อง
            if (activeOrder?._id) {
              try {
                // 1. ดึง AssignEmployee พร้อม user_id
                const assignEmployees = await this.assignEmployeeModel
                  .find({
                    assign_order_id: activeOrder._id.toString(),
                    status: 'active',
                  })
                  .populate<{ user_id: IUser }>('user_id')
                  .lean();

                // 2. ดึงข้อมูลพนักงานแยกต่างหาก
                const employeeIds = assignEmployees
                  .map((assign) => assign.user_id?.employee_id)
                  .filter((id): id is string => !!id);

                const employees = await this.employeeModel
                  .find<IEmployee>({ employee_id: { $in: employeeIds } })
                  .lean();

                // 3. Map ข้อมูลเข้าด้วยกัน
                activeEmployees = assignEmployees.map(
                  (assign): IEmployeeDetail => {
                    const userData = assign.user_id || ({} as IUser);
                    const employeeData =
                      employees.find(
                        (emp) => emp.employee_id === userData.employee_id,
                      ) || ({} as IEmployee);

                    return {
                      id: userData._id.toString() || '',
                      employee_id: userData.employee_id || '',
                      name:
                        employeeData.first_name && employeeData.last_name
                          ? `${employeeData.first_name} ${employeeData.last_name}`.trim()
                          : 'N/A',
                    };
                  },
                );
              } catch (error) {
                console.error('Error fetching active employees:', {
                  message: (error as Error).message,
                  stack: (error as Error).stack,
                });
                activeEmployees = [];
              }
            }

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
                counter: machine.counter || 0,
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
                        plan_cycle_time: productionOrder.plan_cycle_time,
                        weight: cavity?.weight || 0,
                        weight_runner: cavity?.runner || 0,
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
      const machine = new this.machineInfoModel(data);
      await machine.save();

      return {
        status: 'success',
        message: 'Machine created successfully',
        data: [machine],
      };
    } catch (error) {
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
  ): number {
    if (!cycleTime) return 0;
    const runningTimeInSeconds =
      (new Date().getTime() - new Date(startTime).getTime()) / 1000;
    const theoreticalOutput = runningTimeInSeconds / cycleTime;
    if (!theoreticalOutput) return 0;
    const efficiency = (totalGood / theoreticalOutput) * 100;
    return Math.round(efficiency * 100) / 100; // Round to 2 decimal places
  }
}
