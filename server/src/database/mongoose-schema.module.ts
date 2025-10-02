import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Production Management
import {
  ProductionOrder,
  ProductionOrderSchema,
} from 'src/schema/production-order.schema';
import {
  ProductionRecord,
  ProductionRecordSchema,
} from 'src/schema/production-record.schema';
import { AssignOrder, AssignOrderSchema } from 'src/schema/assign-order.schema';
import {
  AssignEmployee,
  AssignEmployeeSchema,
} from 'src/schema/assign-employee.schema';

// Machine Management
import { MachineInfo, MachineInfoSchema } from 'src/schema/machine-info.schema';
import {
  TimelineMachine,
  TimelineMachineSchema,
} from 'src/schema/timeline-machine.schema';

// Master Data
import {
  MasterCavity,
  MasterCavitySchema,
} from 'src/schema/master-cavity.schema';
import {
  MasterNotGood,
  MasterNotGoodSchema,
} from 'src/schema/master-not-good.schema';
import { MasterPart, MasterPartSchema } from '../schema/master_parts.schema';

// User Management
import { Employee, EmployeeSchema } from 'src/schema/employee.schema';
import { User, UserSchema } from 'src/schema/user.schema';

// SAP Integration
import { SAPSyncLog, SAPSyncLogSchema } from '../schema/sap_sync_log.schema';
import {
  MachineCounterLog,
  MachineCounterLogSchema,
} from '../schema/machine-counter-log.schema';
import {
  PrinterDevice,
  PrinterDeviceSchema,
} from '../schema/printer-device.schema';
import {
  SerialCounter,
  SerialCounterSchema,
} from '../schema/serial-counter.schema';
import { LabelJob, LabelJobSchema } from 'src/schema/label-job.shema';
import {
  CoProductRecord,
  CoProductRecordSchema,
} from 'src/schema/co-product-reccord.shema';
import {
  ProductionPlanning,
  ProductionPlanningSchema,
} from 'src/schema/production-planning.schema';
import { OEEHourly, OEEHourlySchema } from 'src/schema/oee-hourly.schema';
import { Material, MaterialSchema } from 'src/schema/material.schema';
import {
  MaterialLocation,
  MaterialLocationSchema,
} from 'src/schema/material-location.schema';
import {
  MaterialPosition,
  MaterialPositionSchema,
} from 'src/schema/material-position.schema';
import {
  MaterialTransaction,
  MaterialTransactionSchema,
} from 'src/schema/material-transaction.schema';
import {
  PlannedDowntime,
  PlannedDowntimeSchema,
} from 'src/schema/planned-downtime.schema';
import { OEEDaily, OEEDailySchema } from 'src/schema/oee-daily.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      // Production Management
      { name: ProductionOrder.name, schema: ProductionOrderSchema },
      { name: ProductionRecord.name, schema: ProductionRecordSchema },
      { name: AssignOrder.name, schema: AssignOrderSchema },
      { name: AssignEmployee.name, schema: AssignEmployeeSchema },
      { name: SerialCounter.name, schema: SerialCounterSchema },
      { name: CoProductRecord.name, schema: CoProductRecordSchema },
      { name: ProductionPlanning.name, schema: ProductionPlanningSchema },

      // Material Management
      { name: Material.name, schema: MaterialSchema },
      { name: MaterialLocation.name, schema: MaterialLocationSchema },
      { name: MaterialPosition.name, schema: MaterialPositionSchema },
      { name: MaterialTransaction.name, schema: MaterialTransactionSchema },

      // Machine Management
      { name: MachineInfo.name, schema: MachineInfoSchema },
      { name: TimelineMachine.name, schema: TimelineMachineSchema },

      //OEE
      { name: OEEHourly.name, schema: OEEHourlySchema },
      { name: OEEDaily.name, schema: OEEDailySchema },
      { name: PlannedDowntime.name, schema: PlannedDowntimeSchema },

      // Printter Management
      { name: PrinterDevice.name, schema: PrinterDeviceSchema },

      // Label Job
      { name: LabelJob.name, schema: LabelJobSchema },

      // Master Data
      { name: MasterCavity.name, schema: MasterCavitySchema },
      { name: MasterNotGood.name, schema: MasterNotGoodSchema },
      { name: MasterPart.name, schema: MasterPartSchema },

      // User Management
      { name: Employee.name, schema: EmployeeSchema },
      { name: User.name, schema: UserSchema },

      // Counter log
      { name: MachineCounterLog.name, schema: MachineCounterLogSchema },

      // SAP Integration
      { name: SAPSyncLog.name, schema: SAPSyncLogSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongooseSchemaModule {}
