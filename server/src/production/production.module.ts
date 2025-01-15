import { Module } from '@nestjs/common';
import { SqlOrderController } from './sql-order/sql-order.controller';
import { MongooseSchemaModule } from 'src/modules/database/mongoose-schema.module';
import { SqlOrderService } from './sql-order/sql-order.service';
import { DatabaseModule } from 'src/modules/database/database.module';
import { ProductionOrderController } from './production-order/production-order.controller';
import { ProductionOrderService } from './production-order/production-order.service';

@Module({
  imports: [MongooseSchemaModule, DatabaseModule],
  controllers: [SqlOrderController, ProductionOrderController],
  providers: [SqlOrderService, ProductionOrderService],
  exports: [SqlOrderService],
})
export class ProductionModule {}
