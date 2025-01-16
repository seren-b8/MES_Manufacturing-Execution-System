import { Module } from '@nestjs/common';
import { MachineInfoController } from './machine-info/machine-info.controller';
import { MachineCavityController } from './machine-cavity/machine-cavity.controller';
import { MachineService } from './machine.service';
import { MachineInfoService } from './machine-info/machine-info.service';
import { MongooseSchemaModule } from 'src/modules/database/mongoose-schema.module';
import { DatabaseModule } from 'src/modules/database/database.module';
import { MachineCavityService } from './machine-cavity/machine-cavity.service';

@Module({
  imports: [MongooseSchemaModule, DatabaseModule],
  controllers: [MachineInfoController, MachineCavityController],
  providers: [MachineService, MachineInfoService, MachineCavityService],
  exports: [MachineInfoService],
})
export class MachineModule {}
