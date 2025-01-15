import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AssignEmployee,
  AssignEmployeeSchema,
} from 'src/schema/assign-employee.schema';
import {
  AssignNotGood,
  AssignNotGoodSchema,
} from 'src/schema/assign-not-good.schema';
import { AssignOrder, AssignOrderSchema } from 'src/schema/assign-order.schema';
import { MachineInfo, MachineInfoSchema } from 'src/schema/machine-info.schema';
import {
  MasterNotGood,
  MasterNotGoodSchema,
} from 'src/schema/master-not-good.schema';
import { Employee, EmployeeSchema } from 'src/schema/employee.schema';
import {
  LogAssignEmployee,
  LogAssignEmployeeSchema,
} from 'src/schema/log-assign-employee.schema';
import {
  LogAssignNotGood,
  LogAssignNotGoodSchema,
} from 'src/schema/log-assign-not-good.schema';
import {
  LogAssignOrder,
  LogAssignOrderSchema,
} from 'src/schema/log-assign-order.schema';
import {
  MasterCavity,
  MasterCavitySchema,
} from 'src/schema/master-cavity.schema';
// import {
//   ProductionComponent,
//   ProductionComponentSchema,
// } from 'src/schema/production-component.schema';
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
  TemporaryEmployee,
  TemporaryEmployeeSchema,
} from 'src/schema/temporary-employees.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssignEmployee.name, schema: AssignEmployeeSchema },
      { name: AssignNotGood.name, schema: AssignNotGoodSchema },
      { name: AssignOrder.name, schema: AssignOrderSchema },
      { name: MachineInfo.name, schema: MachineInfoSchema },
      { name: MasterNotGood.name, schema: MasterNotGoodSchema },
    ]),
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
      { name: LogAssignEmployee.name, schema: LogAssignEmployeeSchema },
      { name: LogAssignNotGood.name, schema: LogAssignNotGoodSchema },
      { name: LogAssignOrder.name, schema: LogAssignOrderSchema },
      { name: MasterCavity.name, schema: MasterCavitySchema },
      { name: TemporaryEmployee.name, schema: TemporaryEmployeeSchema },
    ]),
    MongooseModule.forFeature([
      // { name: ProductionComponent.name, schema: ProductionComponentSchema },
      { name: ProductionOrder.name, schema: ProductionOrderSchema },
      { name: TimelineMachine.name, schema: TimelineMachineSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongooseSchemaModule {}
