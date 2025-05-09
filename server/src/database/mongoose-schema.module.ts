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

@Module({
  imports: [
    MongooseModule.forFeature([
      // Production Management
      { name: ProductionOrder.name, schema: ProductionOrderSchema },
      { name: ProductionRecord.name, schema: ProductionRecordSchema },
      { name: AssignOrder.name, schema: AssignOrderSchema },
      { name: AssignEmployee.name, schema: AssignEmployeeSchema },
      { name: SerialCounter.name, schema: SerialCounterSchema },

      // Machine Management
      { name: MachineInfo.name, schema: MachineInfoSchema },
      { name: TimelineMachine.name, schema: TimelineMachineSchema },

      // Printter Management
      { name: PrinterDevice.name, schema: PrinterDeviceSchema },

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
