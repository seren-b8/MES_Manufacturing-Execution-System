import { Module } from '@nestjs/common';
import { SqlOrderController } from './sap-order/sap-order.controller';
import { MongooseSchemaModule } from 'src/shared/modules/database/mongoose-schema.module';
import { SapOrderService } from './sap-order/sap-order.service';
import { DatabaseModule } from 'src/shared/modules/database/database.module';
import { ProductionOrderController } from './production-order/production-order.controller';
import { ProductionOrderService } from './production-order/production-order.service';
import { ProductionRecordService } from './production-reccord/production-reccord.service';
import { ProductionRecordController } from './production-reccord/production-reccord.controller';

@Module({
  imports: [MongooseSchemaModule, DatabaseModule],
  controllers: [
    SqlOrderController,
    ProductionOrderController,
    ProductionRecordController,
  ],
  providers: [SapOrderService, ProductionOrderService, ProductionRecordService],
  exports: [SapOrderService, ProductionOrderService, ProductionRecordService],
})
export class ProductionModule {}
