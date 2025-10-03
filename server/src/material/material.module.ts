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

@Module({
  imports: [MongooseSchemaModule],
  controllers: [
    MaterialController,
    TransactionController,
    LocationController,
    PositionController,
  ],
  providers: [
    MaterialService,
    TransactionService,
    LocationService,
    PositionService,
  ],
  exports: [MaterialService],
})
export class MaterialModule {}
