import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { OEEController } from './oee.controller';
import { OEEService } from './services/oee.service';
import { QualityService } from './services/quality.service';
import { AvailabilityService } from './services/availability.service';
import { PerformanceService } from './services/performance.service';
import { MongooseSchemaModule } from 'src/database/mongoose-schema.module';

@Module({
  imports: [
    MongooseSchemaModule,
    ScheduleModule.forRoot(),
    // TODO: Import required modules (ProductionModule, MachineModule, AssignModule)
  ],
  controllers: [OEEController],
  providers: [
    OEEService,
    QualityService,
    AvailabilityService,
    PerformanceService,
  ],
  exports: [OEEService],
})
export class OEEModule {}
