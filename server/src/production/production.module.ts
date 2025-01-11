import { Module } from '@nestjs/common';
import { ProductionOrderController } from './production-order/production-order.controller';
import { SqlOrderController } from './sql-order/sql-order.controller';
import { ProductionService } from './production.service';

@Module({
  controllers: [ProductionOrderController, SqlOrderController],
  providers: [ProductionService]
})
export class ProductionModule {}
