import { Module } from '@nestjs/common';
import { MongooseSchemaModule } from 'src/database/mongoose-schema.module';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { MesCacheModule } from 'src/shared/cache/cache.module';
import { FileClientModule } from 'src/shared/services/file-client/file-client.module';
import { LabelController } from './label.controller';
import { LabelGeneratorService } from './services/label-generator.service';
import { LabelService } from './label.service';
import { MachineModule } from 'src/machine/machine.module';

@Module({
  imports: [
    MongooseSchemaModule,
    DatabaseModule,
    MesCacheModule,
    MachineModule,
    ConfigModule,
    FileClientModule,
  ],
  controllers: [LabelController],
  providers: [LabelGeneratorService, LabelService],
  exports: [LabelGeneratorService, LabelService],
})
export class LabelModule {}
