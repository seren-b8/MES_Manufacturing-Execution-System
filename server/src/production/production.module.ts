import { Module } from '@nestjs/common';
import { SqlOrderController } from './sap-order/sap-order.controller';
import { MongooseSchemaModule } from 'src/shared/modules/database/mongoose-schema.module';
import { SapOrderService } from './sap-order/sap-order.service';
import { DatabaseModule } from 'src/shared/modules/database/database.module';
import { ProductionOrderController } from './production-order/production-order.controller';
import { ProductionOrderService } from './production-order/production-order.service';
import { ProductionRecordService } from './production-reccord/production-reccord.service';
import { ProductionRecordController } from './production-reccord/production-reccord.controller';
import { SapSyncController } from './sap-sync/sap-sync.controller';
import { SapProductionSyncService } from './sap-sync/sap-sync.service';
import { SAPDataTransformationService } from './sap-sync/sap-transformmation.service';

@Module({
  imports: [MongooseSchemaModule, DatabaseModule],
  controllers: [
    SqlOrderController,
    ProductionOrderController,
    ProductionRecordController,
    SapSyncController,
  ],
  providers: [
    SapOrderService,
    ProductionOrderService,
    ProductionRecordService,
    SapProductionSyncService,
    SAPDataTransformationService,
  ],
  exports: [
    SapOrderService,
    ProductionOrderService,
    ProductionRecordService,
    SapProductionSyncService,
  ],
})
export class ProductionModule {}
