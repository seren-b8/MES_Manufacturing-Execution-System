import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AssignEmployee,
  AssignEmployeeSchema,
} from 'src/schema/assign-employee.schema';
import { AssignOrder, AssignOrderSchema } from 'src/schema/assign-order.schema';
import { MachineInfo, MachineInfoSchema } from 'src/schema/machine-info.schema';
import {
  MasterNotGood,
  MasterNotGoodSchema,
} from 'src/schema/master-not-good.schema';
import { Employee, EmployeeSchema } from 'src/schema/employee.schema';
import {
  MasterCavity,
  MasterCavitySchema,
} from 'src/schema/master-cavity.schema';
import {
  ProductionOrder,
  ProductionOrderSchema,
} from 'src/schema/production-order.schema';
import {
  TimelineMachine,
  TimelineMachineSchema,
} from 'src/schema/timeline-machine.schema';
import { User, UserSchema } from 'src/schema/user.schema';
import {
  ProductionRecord,
  ProductionRecordSchema,
} from 'src/schema/production-record.schema';

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
