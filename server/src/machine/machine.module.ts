import { Module } from '@nestjs/common';
import { MachineInfoController } from './machine-info/machine-info.controller';
import { MachineCavityController } from './machine-cavity/machine-cavity.controller';
import { MachineService } from './machine.service';
import { MachineInfoService } from './machine-info/machine-info.service';
import { MongooseSchemaModule } from 'src/database/mongoose-schema.module';
import { DatabaseModule } from 'src/database/database.module';
import { MachineCavityService } from './machine-cavity/machine-cavity.service';
import { MasterNotGoodController } from './master-not-good/master-not-good.controller';
import { MasterNotGoodService } from './master-not-good/master-not-good.service';
import { MasterPartsController } from './master-parts/master-parts.controller';
import { MasterPartsService } from './master-parts/master-parts.service';
import { PrinterDevicesController } from './printer/printer.controller';
import { PrinterDevicesService } from './printer/printer.service';
import { ConfigModule } from '@nestjs/config';
import { CustomCacheKeyGenerator } from 'src/shared/utils/custom-cache-key.generator';
import { MachineAnalysisCacheInterceptor } from './interceptors/machine-analysis-cache.interceptor';
import { MesCacheModule } from 'src/shared/cache/cache.module';
import { FileClientModule } from 'src/shared/services/file-client/file-client.module';

@Module({
  imports: [
    MongooseSchemaModule,
    DatabaseModule,
    MesCacheModule,
    ConfigModule,
    FileClientModule,
  ],
  controllers: [
    MachineInfoController,
    MachineCavityController,
    MasterNotGoodController,
    MasterPartsController,
    PrinterDevicesController,
  ],
  providers: [
    MachineService,
    MachineInfoService,
    MachineCavityService,
    MasterNotGoodService,
    MasterPartsService,
    PrinterDevicesService,
    CustomCacheKeyGenerator,
    MachineAnalysisCacheInterceptor,
  ],
  exports: [MachineInfoService],
})
export class MachineModule {}
