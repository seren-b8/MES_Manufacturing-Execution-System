import { Module } from '@nestjs/common';
import { SqlOrderController } from './sap-order/sap-order.controller';
import { MongooseSchemaModule } from 'src/database/mongoose-schema.module';
import { SapOrderService } from './sap-order/sap-order.service';
import { DatabaseModule } from 'src/database/database.module';
import { ProductionOrderController } from './production-order/production-order.controller';
import { ProductionOrderService } from './production-order/production-order.service';
import { ProductionRecordService } from './production-reccord/production-reccord.service';
import { ProductionRecordController } from './production-reccord/production-reccord.controller';
import { SapSyncController } from './sap-sync/sap-sync.controller';
import { SapProductionSyncService } from './sap-sync/sap-sync.service';
import { SapSyncValidationService } from './sap-sync/sap-sync-validation.service';
import { AssignModule } from 'src/assign/assign.module';
import { MachineModule } from 'src/machine/machine.module';
import { SapSyncLogService } from './sap-sync/sap-sync-log.service';
import { SerialCodeService } from './serial-code/serialcode.service';
import { CoProductService } from './co-product/co-product.service';
import { CoProductController } from './co-product/co-product.controller';
import { LabelModule } from 'src/label/label.module';

@Module({
  imports: [
    MongooseSchemaModule,
    DatabaseModule,
    AssignModule,
    MachineModule,
    LabelModule,
  ],
  controllers: [
    SqlOrderController,
    ProductionOrderController,
    ProductionRecordController,
    SapSyncController,
    CoProductController,
  ],
  providers: [
    SapOrderService,
    ProductionOrderService,
    ProductionRecordService,
    SapProductionSyncService,
    SapSyncValidationService,
    SapSyncLogService,
    SerialCodeService,
    CoProductService,
  ],
  exports: [
    SapOrderService,
    ProductionOrderService,
    ProductionRecordService,
    SapProductionSyncService,
    SapSyncValidationService,
    SapSyncLogService,
    SerialCodeService,
    CoProductService,
  ],
})
export class ProductionModule {}
