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
        createdAt: {
          $gte: new Date(timeFrame.start_time),
          $lte: new Date(timeFrame.end_time),
        },
      });
      return machineLog;
    } catch (error) {
      console.error('Error getting target cycle time:', error);
      return null;
    }
  }
}
