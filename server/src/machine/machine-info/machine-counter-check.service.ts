// import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { AssignEmployee } from 'src/shared/modules/schema/assign-employee.schema';
// import { AssignOrder } from 'src/shared/modules/schema/assign-order.schema';
// import { Employee } from 'src/shared/modules/schema/employee.schema';
// import { MachineInfo } from 'src/shared/modules/schema/machine-info.schema';
// import { ProductionOrder } from 'src/shared/modules/schema/production-order.schema';
// import { MasterCavity } from 'src/shared/modules/schema/master-cavity.schema';
// import { TimelineMachine } from 'src/shared/modules/schema/timeline-machine.schema';
// import * as _ from 'lodash';
// import { MasterPart } from 'src/shared/modules/schema/master_parts.schema';
// import * as moment from 'moment-timezone';
// import { ProductionRecord } from 'src/shared/modules/schema/production-record.schema';
// import { MachineCounterLog } from 'src/shared/modules/schema/machine-counter-log.schema';

// @Injectable()
// export class MachineInfoService {
//   constructor(
//     @InjectModel(MachineInfo.name) private machineInfoModel: Model<MachineInfo>,

//     @InjectModel(MasterCavity.name)
//     private masterCavityModel: Model<MasterCavity>,

//     @InjectModel(MachineCounterLog.name)
//     private machineCounterLogModel: Model<MachineCounterLog>,
//   ) {}

//   async checkMachineCounter(
//     machineId: string,
//     counter: number,
//   ): Promise<boolean> {
//     const machineInfo = await this.machineInfoModel.findById(machineId).lean();

//     if (!machineInfo) {
//       throw new HttpException('Machine not found', HttpStatus.NOT_FOUND);
//     }

//     const machineCounterLog = await this.machineCounterLogModel
//       .findOne({ machine_id: machineId })
//       .sort({ created_at: -1 })
//       .lean();
//   }
// }
