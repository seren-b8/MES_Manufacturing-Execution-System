import { TimeFrame } from './../../shared/interface/oee.d';
import { Injectable } from '@nestjs/common';
import { TimeFrameDto } from '../dto/timeframe.dto';
import { InjectModel } from '@nestjs/mongoose';
import { ProductionRecord } from 'src/schema/production-record.schema';
import { Model } from 'mongoose';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { MachineCounterLog } from 'src/schema/machine-counter-log.schema';
import { now } from 'moment';
import { MachineInfo } from 'src/schema/machine-info.schema';

@Injectable()
export class PerformanceService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private productionRecordModel: Model<ProductionRecord>,
    @InjectModel(AssignOrder.name)
    private assignOrderModel: Model<AssignOrder>,
    @InjectModel(ProductionOrder.name)
    private productionOrderModel: Model<ProductionOrder>,
    @InjectModel(MachineCounterLog.name)
    private machineCounterLogModel: Model<MachineCounterLog>,
    @InjectModel(MachineInfo.name) private machineinfoModel: Model<MachineInfo>,
  ) {}

  async calculate(
    machineNumber: string,
    timeframe: TimeFrame,
  ): Promise<number> {
    // TODO: Implement performance calculation logic
    return 0;
  }

  async getCycleTime(
    machineNumber: string,
    timeFrame: TimeFrame,
  ): Promise<any> {
    try {
      const machineLog = await this.machineCounterLogModel.find({
        machine_number: machineNumber,
        is_reset_suspected: false,
        is_abnormal_change: false,
        forced_by_time_threshold: false,
        createdAt: {
          $gte: new Date(timeFrame.start_time),
          $lte: new Date(timeFrame.end_time),
        },
      });

      const timeframeDurationMs =
        new Date(timeFrame.end_time).getTime() -
        new Date(timeFrame.start_time).getTime();

      const timeframeDurationSeconds = timeframeDurationMs / 1000;

      const targetCycleTime = await this.getTargetCycleTime(machineNumber);

      const theoreticalShots = timeframeDurationSeconds / targetCycleTime;

      const actualShots = machineLog.reduce(
        (sum, log) => sum + log.counter_change,
        0,
      );

      const performance = (actualShots / theoreticalShots) * 100;

      return {
        performance,
        actualShots,
        theoreticalShots,
        targetCycleTime,
        timeframeDurationSeconds,
      };
    } catch (error) {
      console.error('Error getting target cycle time:', error);
      return null;
    }
  }

  async getTargetCycleTime(machineNumber: string): Promise<number> {
    const machineData = await this.getMachineWithTargetCycleTime(machineNumber);

    if (
      !machineData ||
      !machineData.active_orders ||
      machineData.active_orders.length === 0
    ) {
      throw new Error('No active orders found for machine');
    }

    const activeOrder = machineData.active_orders[0];
    const cavity_count = activeOrder.cavity_info?.cavity_count || 1;
    const cavity_cycle_time = activeOrder.cavity_info?.cavity_cycle_time || 0;

    // ใช้ order แรกที่มี target_cycle_time
    const orderWithCycleTime = machineData.active_orders.find(
      (order) => order.target_cycle_time && order.target_cycle_time > 0,
    );

    if (!orderWithCycleTime) {
      throw new Error('No valid target cycle time found');
    }
    let targetCycleTime = orderWithCycleTime.target_cycle_time;
    if (cavity_cycle_time <= 0 && cavity_count != 0) {
      targetCycleTime = targetCycleTime * cavity_count;
    } else if (cavity_cycle_time > 0) {
      targetCycleTime = cavity_cycle_time;
    }

    return targetCycleTime;
  }

  private async getMachineWithTargetCycleTime(machineNumber: string) {
    const result = await this.machineinfoModel.aggregate([
      { $match: { machine_number: machineNumber } },

      {
        $lookup: {
          from: 'assign_order',
          let: { machineNum: '$machine_number' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$machine_number', '$$machineNum'] },
                status: 'active',
              },
            },
            // Lookup Production Order
            {
              $lookup: {
                from: 'production_order',
                localField: 'production_order_id',
                foreignField: '_id',
                as: 'production_order',
              },
            },
            {
              $unwind: {
                path: '$production_order',
                preserveNullAndEmptyArrays: true,
              },
            },
            // Lookup Master Part
            {
              $lookup: {
                from: 'master_parts',
                localField: 'production_order.material_number',
                foreignField: 'material_number',
                as: 'master_part',
              },
            },
            {
              $unwind: {
                path: '$master_part',
                preserveNullAndEmptyArrays: true,
              },
            },
            // Lookup Master Cavity
            {
              $lookup: {
                from: 'master_cavity',
                localField: 'master_part._id',
                foreignField: 'parts',
                as: 'master_cavity',
              },
            },
            {
              $unwind: {
                path: '$master_cavity',
                preserveNullAndEmptyArrays: true,
              },
            },
            // Calculate Target Cycle Time
            {
              $addFields: {
                calculated_target_cycle_time: {
                  $cond: {
                    if: { $gt: ['$master_cavity.cycle_time', 0] },
                    then: '$master_cavity.cycle_time', // ใช้จาก cavity ถ้ามี
                    else: {
                      $multiply: [
                        '$production_order.plan_cycle_time',
                        { $ifNull: ['$master_cavity.cavity', 1] },
                      ],
                    },
                  },
                },
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
                production_order: {
                  _id: '$production_order._id',
                  order_id: '$production_order.order_id',
                  material_number: '$production_order.material_number',
                  plan_cycle_time: '$production_order.plan_cycle_time',
                },
                cavity_info: {
                  cavity_count: '$master_cavity.cavity',
                  cavity_cycle_time: '$master_cavity.cycle_time',
                },
                target_cycle_time: '$calculated_target_cycle_time',
              },
            },
          ],
          as: 'active_orders',
        },
      },

      {
        $project: {
          machine_number: 1,
          machine_name: 1,
          status: 1,
          active_orders: 1,
        },
      },
    ]);

    return result[0];
  }
}
