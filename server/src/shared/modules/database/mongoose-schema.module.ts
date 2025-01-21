import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AssignEmployee,
  AssignEmployeeSchema,
} from 'src/shared/modules/schema/assign-employee.schema';
import {
  AssignOrder,
  AssignOrderSchema,
} from 'src/shared/modules/schema/assign-order.schema';
import {
  MachineInfo,
  MachineInfoSchema,
} from 'src/shared/modules/schema/machine-info.schema';
import {
  MasterNotGood,
  MasterNotGoodSchema,
} from 'src/shared/modules/schema/master-not-good.schema';
import {
  Employee,
  EmployeeSchema,
} from 'src/shared/modules/schema/employee.schema';
import {
  MasterCavity,
  MasterCavitySchema,
} from 'src/shared/modules/schema/master-cavity.schema';
import {
  ProductionOrder,
  ProductionOrderSchema,
} from 'src/shared/modules/schema/production-order.schema';
import {
  TimelineMachine,
  TimelineMachineSchema,
} from 'src/shared/modules/schema/timeline-machine.schema';
import { User, UserSchema } from 'src/shared/modules/schema/user.schema';
import {
  ProductionRecord,
  ProductionRecordSchema,
} from 'src/shared/modules/schema/production-record.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssignEmployee.name, schema: AssignEmployeeSchema },
      { name: ProductionRecord.name, schema: ProductionRecordSchema },
      { name: AssignOrder.name, schema: AssignOrderSchema },
      { name: MachineInfo.name, schema: MachineInfoSchema },
      { name: MasterNotGood.name, schema: MasterNotGoodSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: MasterCavity.name, schema: MasterCavitySchema },
      { name: ProductionOrder.name, schema: ProductionOrderSchema },
      { name: TimelineMachine.name, schema: TimelineMachineSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongooseSchemaModule {}
