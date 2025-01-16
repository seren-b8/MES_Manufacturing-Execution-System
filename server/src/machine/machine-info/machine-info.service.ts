// src/machine/machine-info/machine-info.service.ts

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/interface';
import { MachineInfo } from 'src/schema/machine-info.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';

@Injectable()
export class MachineInfoService {
  connection: any;
  constructor(
    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,
    @InjectModel(MachineInfo.name)
    private readonly machineInfoModel: Model<MachineInfo>,
  ) {}

  async findAll(query: any = {}) {
    try {
      const machines = await this.machineInfoModel.find(query).lean();
      return {
        status: 'success',
        message: 'Retrieved machines successfully',
        data: machines,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve machines: ' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createMachine(
    machineInfo: MachineInfo,
  ): Promise<ResponseFormat<MachineInfo>> {
    try {
      // Validate required fields
      if (
        !machineInfo.machine_name ||
        !machineInfo.machine_number ||
        !machineInfo.work_center
      ) {
        throw new HttpException(
          {
            status: 'error',
            message:
              'Machine name, machine number, and work center are required',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check for duplicate machine
      const existingMachine = await this.machineInfoModel.findOne({
        name: machineInfo.machine_number,
      });

      if (existingMachine) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine with this name already exists',
            data: [],
          },
          HttpStatus.CONFLICT,
        );
      }

      // Create new machine with timestamps
      const newMachine = new this.machineInfoModel({
        ...machineInfo,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Save to database within transaction
      const savedMachine = await this.connection.transaction(
        async (session) => {
          return await newMachine.save({ session });
        },
      );

      return {
        status: 'success',
        message: 'Machine created successfully',
        data: savedMachine,
      };
    } catch (error) {
      // Log unexpected errors if not HttpException
      if (!(error instanceof HttpException)) {
        console.error('Error creating machine:', error);

        throw new HttpException(
          {
            status: 'error',
            message: 'An error occurred while creating the machine',
            data: [],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw error; // Re-throw HttpException errors
    }
  }

  // ดึงข้อมูลเครื่องจักรตาม machine number
  async findByMachineNumber(machineNumber: string) {
    try {
      const machine = await this.machineInfoModel.findOne({
        machine_number: machineNumber,
      });
      if (!machine) {
        return {
          status: 'error',
          message: 'Machine not found',
          data: [],
        };
      }
      return {
        status: 'success',
        message: 'Retrieved machine successfully',
        data: machine,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to retrieve machine',
        data: [],
        details: error.message,
      };
    }
  }

  // อัพเดทสถานะเครื่องจักร
  async updateMachineStatus(machineNumber: string, status: string) {
    try {
      const updatedMachine = await this.machineInfoModel.findOneAndUpdate(
        { machine_number: machineNumber },
        { status: status },
        { new: true },
      );
      if (!updatedMachine) {
        return {
          status: 'error',
          message: 'Machine not found',
          data: [],
        };
      }
      return {
        status: 'success',
        message: 'Updated machine status successfully',
        data: updatedMachine,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to update machine status: ' + error.message,
        data: [],
      };
    }
  }

  // อัพเดทค่า Counter
  async updateCounter(machineNumber: string, counter: number) {
    try {
      const updatedMachine = await this.machineInfoModel.findOneAndUpdate(
        { machine_number: machineNumber },
        { counter: counter },
        { new: true },
      );
      if (!updatedMachine) {
        return {
          status: 'error',
          message: 'Machine not found',
          data: [],
        };
      }
      return {
        status: 'success',
        message: 'Updated counter successfully',
        data: updatedMachine,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to update counter: ' + error.message,
        data: [],
      };
    }
  }

  async getWorkCenterSummary() {
    try {
      const result = await this.productionOrderModel.aggregate([
        // Initial lookup with machine_info
        {
          $lookup: {
            from: 'machine_info',
            localField: 'work_center',
            foreignField: 'work_center',
            as: 'machines',
          },
        },
        {
          $match: {
            'machines.0': { $exists: true },
          },
        },
        // Lookup assign_order for active orders
        {
          $lookup: {
            from: 'assign_order',
            let: { work_center: '$work_center' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$work_center', '$$work_center'] },
                      { $eq: ['$status', 'pending'] },
                    ],
                  },
                },
              },
            ],
            as: 'active_orders',
          },
        },
        // Lookup assign_employee for active assignments
        {
          $lookup: {
            from: 'assign_employee',
            let: { work_center: '$work_center' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$work_center', '$$work_center'] },
                      { $eq: ['$status', 'active'] },
                    ],
                  },
                },
              },
            ],
            as: 'active_assignments',
          },
        },
        // Lookup all orders for this work center
        {
          $lookup: {
            from: 'production_order',
            let: { work_center: '$work_center' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$work_center', '$$work_center'] },
                },
              },
            ],
            as: 'all_orders',
          },
        },
        // Group by work_center
        {
          $group: {
            _id: '$work_center',
            total_orders: { $sum: 1 },
            machines: { $first: '$machines' },
            active_orders: { $first: '$active_orders' },
            active_assignments: { $first: '$active_assignments' },
            all_orders: { $first: '$all_orders' },
          },
        },
        // Format the results
        {
          $project: {
            _id: 0,
            work_center: '$_id',
            summary: {
              total_orders: '$total_orders',
              total_machines: { $size: '$machines' },
              assign_orders_count: { $size: '$active_orders' },
              assign_enployee_count: { $size: '$active_assignments' },
            },
            machines: {
              $map: {
                input: '$machines',
                as: 'machine',
                in: {
                  line: '$$machine.line',
                  machine_number: '$$machine.machine_number',
                  machine_name: '$$machine.machine_name',
                  tonnage: '$$machine.tonnage',
                  status: '$$machine.status',
                  orders_count: {
                    $size: {
                      $filter: {
                        input: '$all_orders',
                        as: 'order',
                        cond: {
                          $eq: ['$$order.work_center', '$$machine.work_center'],
                        },
                      },
                    },
                  },
                  active_orders_count: {
                    $size: {
                      $filter: {
                        input: '$active_orders',
                        as: 'order',
                        cond: {
                          $eq: [
                            '$$order.machine_number',
                            '$$machine.machine_number',
                          ],
                        },
                      },
                    },
                  },
                  active_assignments_count: {
                    $size: {
                      $filter: {
                        input: '$active_assignments',
                        as: 'assign',
                        cond: {
                          $eq: [
                            '$$assign.machine_number',
                            '$$machine.machine_number',
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
            assign_orders: {
              $map: {
                input: '$active_orders',
                as: 'order',
                in: {
                  order_id: '$$order.order_id',
                  machine_number: '$$order.machine_number',
                  material_number: '$$order.material_number',
                  target_quantity: '$$order.target_quantity',
                  actual_quantity: '$$order.actual_quantity',
                  datetime_open_order: '$$order.datetime_open_order',
                  production_parameters: '$$order.production_parameters',
                },
              },
            },
            active_assignments: {
              $map: {
                input: '$active_assignments',
                as: 'assign',
                in: {
                  employee_id: '$$assign.employee_id',
                  full_name: '$$assign.full_name',
                  machine_number: '$$assign.machine_number',
                  order_id: '$$assign.order_id',
                  datetime_open_order: '$$assign.datetime_open_order',
                  shift: '$$assign.shift',
                  assignment_details: '$$assign.assignment_details',
                },
              },
            },
          },
        },
        {
          $sort: {
            work_center: 1,
          },
        },
      ]);

      return {
        status: 'success',
        message: 'Retrieved work center summary successfully',
        data: result,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to get work center summary: ' + error.message,
        data: [],
      };
    }
  }
}
