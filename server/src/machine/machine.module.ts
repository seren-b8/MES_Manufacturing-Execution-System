import { Module } from '@nestjs/common';
import { MachineInfoController } from './machine-info/machine-info.controller';
import { MachineCavityController } from './machine-cavity/machine-cavity.controller';
import { MachineService } from './machine.service';
import { MachineInfoService } from './machine-info/machine-info.service';
import { MongooseSchemaModule } from 'src/shared/modules/database/mongoose-schema.module';
import { DatabaseModule } from 'src/shared/modules/database/database.module';
import { MachineCavityService } from './machine-cavity/machine-cavity.service';
import { MasterNotGoodController } from './master-not-good/master-not-good.controller';
import { MasterNotGoodService } from './master-not-good/master-not-good.service';
import { MasterPartsController } from './master-parts/master-parts.controller';
import { MasterPartsService } from './master-parts/master-parts.service';

@Module({
  imports: [MongooseSchemaModule, DatabaseModule],
  controllers: [
    MachineInfoController,
    MachineCavityController,
    MasterNotGoodController,
    MasterPartsController,
  ],
  providers: [
    MachineService,
    MachineInfoService,
    MachineCavityService,
    MasterNotGoodService,
    MasterPartsService,
  ],
  exports: [MachineInfoService],
})
export class MachineModule {}
