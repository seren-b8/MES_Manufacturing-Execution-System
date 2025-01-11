import { Module } from '@nestjs/common';
import { AssignLogController } from './assign-log/assign-log.controller';
import { AssignOrderController } from './assign-order/assign-order.controller';
import { AssignService } from './assign.service';

@Module({
  controllers: [AssignLogController, AssignOrderController],
  providers: [AssignService]
})
export class AssignModule {}
