import { Module } from '@nestjs/common';
import { MongooseSchemaModule } from 'src/database/mongoose-schema.module';
import { DatabaseModule } from 'src/database/database.module';
import { MaterialController } from './material.controller';
import { MaterialService } from './material.service';
import { TransactionController } from './material-transaction/transaction.controller';
import { LocationController } from './material-location/location.controller';
import { TransactionService } from './material-transaction/transaction.service';
import { LocationService } from './material-location/location.service';
import { PositionController } from './material-position/position.controller';
import { PositionService } from './material-position/position.service';
import { SqlService } from 'src/shared/services/sql.service';
import { SAPPOReceiptService } from './sap-po-receipt/receipt.service';
import { SAPPOReceiptController } from './sap-po-receipt/receipt.controller';
import { HttpModule } from '@nestjs/axios';
import { UnifiedReceiptService } from './sap-po-receipt/unified-receipt.service';
import { BatchReceiptService } from './sap-po-receipt/batch-receipt.service';

@Module({
  imports: [
    MongooseSchemaModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [
    MaterialController,
    TransactionController,
    LocationController,
    PositionController,
    SAPPOReceiptController,
  ],
  providers: [
    MaterialService,
    TransactionService,
    LocationService,
    PositionService,
    SqlService,
    SAPPOReceiptService,
    UnifiedReceiptService,
    BatchReceiptService,
  ],
  exports: [MaterialService],
})
export class MaterialModule {}
