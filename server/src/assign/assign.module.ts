import { Module } from '@nestjs/common';
import { AssignOrderController } from './assign-order/assign-order.controller';
import { AssignService } from './assign.service';
import { MongooseSchemaModule } from 'src/shared/modules/database/mongoose-schema.module';
import { DatabaseModule } from 'src/shared/modules/database/database.module';
import { AssignOrderService } from './assign-order/assign-order.service';
import { AssignEmployeeController } from './assign-employee/assign-employee.controller';
import { AssignEmployeeService } from './assign-employee/assign-employee.service';

@Module({
  imports: [MongooseSchemaModule, DatabaseModule],
  controllers: [AssignOrderController, AssignEmployeeController],
  providers: [AssignService, AssignOrderService, AssignEmployeeService],
  exports: [AssignService],
})
export class AssignModule {}
