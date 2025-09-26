import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongooseSchemaModule } from 'src/database/mongoose-schema.module';
import { PlannedDowntimeController } from './planned-downtime.controller';
import { PlannedDowntimeService } from './planned-downtime.service';

@Module({
  imports: [MongooseSchemaModule],
  controllers: [PlannedDowntimeController],
  providers: [PlannedDowntimeService],
  exports: [PlannedDowntimeService],
})
export class PlannedDowntimeModule {}
