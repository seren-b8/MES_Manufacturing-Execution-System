import { TimeFrame } from './../../shared/interface/oee.d';
import { Injectable } from '@nestjs/common';
import { TimeFrameDto } from '../dto/timeframe.dto';
import { InjectModel } from '@nestjs/mongoose';
import { ProductionRecord } from 'src/schema/production-record.schema';
import { Model } from 'mongoose';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { MachineCounterLog } from 'src/schema/machine-counter-log.schema';
import { MachineInfo } from 'src/schema/machine-info.schema';
import { MinLength } from 'class-validator';

export interface ProcessedPerformanceRecord {
  machineNumber: string;
  performance: number; // ปรับทศนิยม 2 ตำแหน่ง
  actualShots: number;
  theoreticalShots: number; // ปรับทศนิยม 2 ตำแหน่ง
  targetCycleTime: number;
  timeframeDurationSeconds: number;
}
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
    machineNumbers: string[],
    timeframe: TimeFrame,
  ): Promise<Map<string, number>> {
    // เปลี่ยน return type
    try {
      return await this.calculateMultiMachine(machineNumbers, timeframe);
    } catch (error) {
      console.error('Error calculating performance:', error);
      // Return empty Map with 0 values for all machines
      const results = new Map();
      machineNumbers.forEach((machine) => results.set(machine, 0));
      return results;
    }
  }

  async getMultiMachinePerformanceArray(
    timeFrame: TimeFrame,
  ): Promise<ProcessedPerformanceRecord[]> {
    const machineNumbers = timeFrame.machine_numbers || [];
    const mapResult = await this.getMultiMachineCycleTime(
      machineNumbers,
      timeFrame,
    );
    return this.processPerformanceData(mapResult);
  }

  async getMultiMachineCycleTime(
    machineNumbers: string[],
    timeFrame: TimeFrame,
  ): Promise<Map<string, any>> {
    try {
      const machineLogs = await this.machineCounterLogModel.aggregate([
        {
          $match: {
            ...(machineNumbers.length > 0
              ? { machine_number: { $in: machineNumbers } }
              : {}),
            is_reset_suspected: false,
            is_abnormal_change: false,
            forced_by_time_threshold: false,
            createdAt: {
              $gte: new Date(timeFrame.start_time),
              $lte: new Date(timeFrame.end_time),
            },
          },
        },
        {
          $group: {
            _id: '$machine_number', // group ตาม machine
            actualShots: { $sum: '$counter_change' },
            logCount: { $sum: 1 },
          },
        },
      ]);
      const timeframeDurationMs =
        new Date(timeFrame.end_time).getTime() -
        new Date(timeFrame.start_time).getTime();

      const timeframeDurationSeconds = timeframeDurationMs / 1000;

      const targetCycleTimes =
        await this.getMultiMachineTargetCycleTime(machineNumbers);

      const results = new Map();

      const machineList =
        machineNumbers.length > 0
          ? machineNumbers
          : machineLogs.map((log) => log._id);

      machineList.forEach((machineNumber) => {
        const machineLog = machineLogs.find((log) => log._id === machineNumber);
        const actualShots = machineLog?.actualShots || 0;
        const targetCycleTime = targetCycleTimes.get(machineNumber) || 0;

        const theoreticalShots =
          targetCycleTime > 0 ? timeframeDurationSeconds / targetCycleTime : 0;
        const performance =
          theoreticalShots > 0 ? (actualShots / theoreticalShots) * 100 : 0;

        results.set(machineNumber, {
          performance,
          actualShots,
          theoreticalShots,
          targetCycleTime,
          timeframeDurationSeconds,
        });
      });

      return results;
    } catch (error) {
      console.error('Error getting target cycle time:', error);
      return null;
    }
  }

  private async getMultiMachineWithTargetCycleTime(machineNumbers: string[]) {
    const results = await this.machineinfoModel.aggregate([
      ...(machineNumbers.length > 0
        ? [
            {
              $match: {
                machine_number: { $in: machineNumbers },
              },
            },
          ]
        : []),
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

    // แปลงเป็น Map สำหรับการค้นหาง่าย
    const resultMap = new Map();
    results.forEach((machine) => {
      resultMap.set(machine.machine_number, machine);
    });

    return resultMap;
  }

  async getMultiMachineTargetCycleTime(
    machineNumbers: string[],
  ): Promise<Map<string, number>> {
    const machineDataMap =
      await this.getMultiMachineWithTargetCycleTime(machineNumbers);
    const results = new Map();

    const machineList =
      machineNumbers.length > 0
        ? machineNumbers
        : Array.from(machineDataMap.keys());

    machineList.forEach((machineNumber) => {
      try {
        const machineData = machineDataMap.get(machineNumber);

        if (
          !machineData ||
          !machineData.active_orders ||
          machineData.active_orders.length === 0
        ) {
          results.set(machineNumber, 0);
          return;
        }

        // Logic เดิมสำหรับคำนวณ target cycle time
        const activeOrder = machineData.active_orders[0];
        const cavity_count = activeOrder.cavity_info?.cavity_count || 1;
        const cavity_cycle_time =
          activeOrder.cavity_info?.cavity_cycle_time || 0;

        const activeOrderCount = machineData.active_orders.length;

        const orderWithCycleTime = machineData.active_orders.find(
          (order) => order.target_cycle_time && order.target_cycle_time > 0,
        );

        if (!orderWithCycleTime) {
          results.set(machineNumber, 0);
          return;
        }

        let targetCycleTime = orderWithCycleTime.target_cycle_time;

        if (cavity_cycle_time <= 0 && cavity_count != 0) {
          targetCycleTime = targetCycleTime * (cavity_count / activeOrderCount);
        } else if (cavity_cycle_time > 0) {
          targetCycleTime = cavity_cycle_time;
        }

        results.set(machineNumber, targetCycleTime);
      } catch (error) {
        console.error(
          `Error calculating target cycle time for ${machineNumber}:`,
          error,
        );
        results.set(machineNumber, 0);
      }
    });

    return results;
  }

  async calculateMultiMachine(
    machineNumbers: string[],
    timeframe: TimeFrame,
  ): Promise<Map<string, number>> {
    try {
      const cycleTimeResults = await this.getMultiMachineCycleTime(
        machineNumbers,
        timeframe,
      );

      const performanceResults = new Map();

      // ตรวจสอบว่า cycleTimeResults เป็น Map หรือไม่
      if (cycleTimeResults instanceof Map) {
        cycleTimeResults.forEach((result, machineNumber) => {
          performanceResults.set(machineNumber, result.performance || 0);
        });
      } else {
        // Fallback: ถ้าไม่ได้ Map กลับมา
        machineNumbers.forEach((machine) => {
          performanceResults.set(machine, 0);
        });
      }

      return performanceResults;
    } catch (error) {
      console.error('Error in calculateMultiMachine:', error);
      const fallbackResults = new Map();
      machineNumbers.forEach((machine) => fallbackResults.set(machine, 0));
      return fallbackResults;
    }
  }

  private processPerformanceData(
    performanceMap: Map<string, any>,
  ): ProcessedPerformanceRecord[] {
    return Array.from(performanceMap.entries()).map(
      ([machineNumber, data]) => ({
        machineNumber,
        performance: Math.round(data.performance * 100) / 100, // ปรับทศนิยม 2 ตำแหน่ง
        actualShots: data.actualShots,
        theoreticalShots: Math.round(data.theoreticalShots * 100) / 100,
        targetCycleTime: data.targetCycleTime,
        timeframeDurationSeconds: data.timeframeDurationSeconds,
      }),
    );
  }

  private calculateFactoryPerformance(performanceArray: any[]): any {
    const factoryTotals = performanceArray.reduce(
      (acc, machine) => {
        acc.totalActualShots += machine.actualShots;
        acc.totalTheoreticalShots += machine.theoreticalShots;
        acc.totalTimeframeDuration += machine.timeframeDurationSeconds;
        acc.activeMachines += machine.actualShots > 0 ? 1 : 0;
        return acc;
      },
      {
        totalActualShots: 0,
        totalTheoreticalShots: 0,
        totalTimeframeDuration: 0,
        activeMachines: 0,
      },
    );

    // คำนวณ Factory Performance จากยอดรวม
    const factoryPerformance =
      factoryTotals.totalTheoreticalShots > 0
        ? Math.round(
            (factoryTotals.totalActualShots /
              factoryTotals.totalTheoreticalShots) *
              100 *
              100,
          ) / 100
        : 0;

    return {
      machineNumber: 'ALL',
      performance: factoryPerformance,
      actualShots: factoryTotals.totalActualShots,
      theoreticalShots:
        Math.round(factoryTotals.totalTheoreticalShots * 100) / 100,
      targetCycleTime:
        factoryTotals.totalTimeframeDuration / factoryTotals.activeMachines ||
        0, // เฉลี่ย
      timeframeDurationSeconds:
        factoryTotals.totalTimeframeDuration / factoryTotals.activeMachines ||
        0,
      activeMachines: factoryTotals.activeMachines,
    };
  }
}
