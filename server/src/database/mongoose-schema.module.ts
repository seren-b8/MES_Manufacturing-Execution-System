import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  ProductionOrder,
  ProductionOrderSchema,
} from '../schema/production-order.schema';
import {
  ProductionRecord,
  ProductionRecordSchema,
} from '../schema/production-record.schema';
import { AssignOrder, AssignOrderSchema } from '../schema/assign-order.schema';
import {
  AssignEmployee,
  AssignEmployeeSchema,
} from '../schema/assign-employee.schema';
import { MachineInfo, MachineInfoSchema } from '../schema/machine-info.schema';
import {
  TimelineMachine,
  TimelineMachineSchema,
} from '../schema/timeline-machine.schema';
import {
  MasterCavity,
  MasterCavitySchema,
} from '../schema/master-cavity.schema';
import {
  MasterNotGood,
  MasterNotGoodSchema,
} from '../schema/master-not-good.schema';
import { MasterPart, MasterPartSchema } from '../schema/master_parts.schema';
import { Employee, EmployeeSchema } from '../schema/employee.schema';
import { User, UserSchema } from '../schema/user.schema';
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
import { LabelJob, LabelJobSchema } from '../schema/label-job.shema';
import {
  CoProductRecord,
  CoProductRecordSchema,
} from '../schema/co-product-reccord.shema';
import {
  ProductionPlanning,
  ProductionPlanningSchema,
} from '../schema/production-planning.schema';
import { OEEHourly, OEEHourlySchema } from '../schema/oee-hourly.schema';
import { Material, MaterialSchema } from '../schema/material.schema';
import {
  MaterialLocation,
  MaterialLocationSchema,
} from '../schema/material-location.schema';
import {
  MaterialPosition,
  MaterialPositionSchema,
} from '../schema/material-position.schema';
import {
  MaterialTransaction,
  MaterialTransactionSchema,
} from '../schema/material-transaction.schema';
import {
  PlannedDowntime,
  PlannedDowntimeSchema,
} from '../schema/planned-downtime.schema';
import { OEEDaily, OEEDailySchema } from '../schema/oee-daily.schema';
import {
  MaterialReceiptItem,
  MaterialReceiptItemSchema,
} from 'src/schema/material-receipt-items';
import {
  MaterialReceipt,
  MaterialReceiptSchema,
} from 'src/schema/material-receipts.schema';
import { BOMItem, BOMItemSchema } from 'src/schema/bom-items.schema';

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
      { name: BOMItem.name, schema: BOMItemSchema },

      // Material Management
      { name: Material.name, schema: MaterialSchema },
      { name: MaterialLocation.name, schema: MaterialLocationSchema },
      { name: MaterialPosition.name, schema: MaterialPositionSchema },
      { name: MaterialTransaction.name, schema: MaterialTransactionSchema },
      { name: MaterialReceiptItem.name, schema: MaterialReceiptItemSchema },
      { name: MaterialReceipt.name, schema: MaterialReceiptSchema },

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
