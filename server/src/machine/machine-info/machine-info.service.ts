// src/machine/machine-info/machine-info.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MachineInfo } from 'src/schema/machine-info.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';

@Injectable()
export class MachineInfoService {
  constructor(
    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,
    @InjectModel(MachineInfo.name)
    private readonly machineInfoModel: Model<MachineInfo>,
  ) {}

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
        // Filter for machines exist
        {
          $match: {
            'machines.0': { $exists: true },
          },
        },
        // Lookup assign_order for current orders
        {
          $lookup: {
            from: 'assign_order',
            localField: 'order_id',
            foreignField: 'order_id',
            as: 'current_orders',
          },
        },
        // Lookup assign_employee for current assignments
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
            as: 'current_assignments',
          },
        },
        // Group by work_center
        {
          $group: {
            _id: '$work_center',
            count: { $sum: 1 },
            machines: { $first: '$machines' },
            orders: {
              $push: {
                order_id: '$order_id',
                material_number: '$material_number',
                target_quantity: '$target_quantity',
                current_order: { $first: '$current_orders' },
              },
            },
            assignments: { $first: '$current_assignments' },
          },
        },
        // Format the results
        {
          $project: {
            _id: 0,
            work_center: '$_id',
            total_orders: '$count',
            total_machines: { $size: '$machines' },
            active_orders: {
              $size: {
                $filter: {
                  input: '$orders',
                  as: 'order',
                  cond: { $ne: ['$$order.current_order', null] },
                },
              },
            },
            active_assignments: { $size: '$assignments' },
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
                  current_assignment: {
                    $filter: {
                      input: '$assignments',
                      as: 'assignment',
                      cond: {
                        $eq: [
                          '$$assignment.machine_number',
                          '$$machine.machine_number',
                        ],
                      },
                    },
                  },
                  current_order: {
                    $filter: {
                      input: '$orders',
                      as: 'order',
                      cond: {
                        $ne: [
                          '$$order.current_order.machine_number',
                          '$$machine.machine_number',
                        ],
                      },
                    },
                  },
                },
              },
            },
            // Add detailed order and assignment information
            orders_detail: {
              $map: {
                input: '$orders',
                as: 'order',
                in: {
                  order_id: '$$order.order_id',
                  material_number: '$$order.material_number',
                  target_quantity: '$$order.target_quantity',
                  status: {
                    $cond: {
                      if: { $ne: ['$$order.current_order', null] },
                      then: 'active',
                      else: 'pending',
                    },
                  },
                },
              },
            },
            assignments_detail: {
              $map: {
                input: '$assignments',
                as: 'assign',
                in: {
                  employee_id: '$$assign.employee_id',
                  full_name: '$$assign.full_name',
                  machine_number: '$$assign.machine_number',
                  datetime_open_order: '$$assign.datetime_open_order',
                  shift: '$$assign.shift',
                },
              },
            },
          },
        },
        // Sort by work_center
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
