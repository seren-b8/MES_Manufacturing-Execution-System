import { Module } from '@nestjs/common';
import { MongooseSchemaModule } from 'src/database/mongoose-schema.module';
import { DatabaseModule } from 'src/database/database.module';
import { MaterialController } from './material.controller';
import { MaterialService } from './material.service';
import { TransactionController } from './material-transaction/transaction.controller';
import { LocationController } from './material-location/location.controller';
import { TransactionService } from './material-transaction/transaction.service';
import { LocationService } from './material-location/location.service';

@Module({
  imports: [MongooseSchemaModule],
  controllers: [MaterialController, TransactionController, LocationController],
  providers: [MaterialService, TransactionService, LocationService],
  exports: [MaterialService],
})
export class MaterialModule {}
