import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssignEmp, AssignEmpSchema } from 'src/schema/assign-emp.schema';
import { AssignNG, AssignNGSchema } from 'src/schema/assign-ng.schema';
import { AssignOrder, AssignOrderSchema } from 'src/schema/assign-order.schema';
import { MachineInfo, MachineInfoSchema } from 'src/schema/machine-info.schema';
import { MasterNG, MasterNGSchema } from 'src/schema/master-ng.schema';
import { Employee, EmployeeSchema } from 'src/schema/employee.schema';
import {
  LogAssignEmp,
  LogAssignEmpSchema,
} from 'src/schema/log-assign-emp.schema';
import {
  LogAssignNG,
  LogAssignNGSchema,
} from 'src/schema/log-assign-ng.schema';
import {
  LogAssignOrder,
  LogAssignOrderSchema,
} from 'src/schema/log-assign-order.schema';
import { Cavity, CavitySchema } from 'src/schema/cavity.schema';
import {
  ProductionComponent,
  ProductionComponentSchema,
} from 'src/schema/production-component.schema';
import {
  ProductionOrder,
  ProductionOrderSchema,
} from 'src/schema/production-order.schema';
import {
  TimelineMachine,
  TimelineMachineSchema,
} from 'src/schema/timeline-machine.schema';
import { User, UserSchema } from 'src/schema/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssignEmp.name, schema: AssignEmpSchema },
      { name: AssignNG.name, schema: AssignNGSchema },
      { name: AssignOrder.name, schema: AssignOrderSchema },
      { name: MachineInfo.name, schema: MachineInfoSchema },
      { name: MasterNG.name, schema: MasterNGSchema },
    ]),
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
      { name: LogAssignEmp.name, schema: LogAssignEmpSchema },
      { name: LogAssignNG.name, schema: LogAssignNGSchema },
      { name: LogAssignOrder.name, schema: LogAssignOrderSchema },
      { name: Cavity.name, schema: CavitySchema },
    ]),
    MongooseModule.forFeature([
      { name: ProductionComponent.name, schema: ProductionComponentSchema },
      { name: ProductionOrder.name, schema: ProductionOrderSchema },
      { name: TimelineMachine.name, schema: TimelineMachineSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongooseSchemaModule {}
