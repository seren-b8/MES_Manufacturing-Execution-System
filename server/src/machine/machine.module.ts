import { Module } from '@nestjs/common';
import { MachineInfoController } from './machine-info/machine-info.controller';
import { MachineCavityController } from './machine-cavity/machine-cavity.controller';
import { MachineService } from './machine.service';
import { MachineInfoService } from './machine-info/machine-info.service';
import { MongooseModule } from '@nestjs/mongoose';
import { MachineInfo, MachineInfoSchema } from 'src/schema/machine-info.schema';
import { MongooseSchemaModule } from 'src/modules/database/mongoose-schema.module';
import { DatabaseModule } from 'src/modules/database/database.module';

@Module({
  imports: [MongooseSchemaModule, DatabaseModule],
  controllers: [MachineInfoController, MachineCavityController],
  providers: [MachineService, MachineInfoService],
  exports: [MachineInfoService],
})
export class MachineModule {}
