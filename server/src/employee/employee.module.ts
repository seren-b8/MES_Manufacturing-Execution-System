import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { DatabaseModule } from 'src/modules/database/database.module';
import { MongooseSchemaModule } from 'src/modules/database/mongoose-schema.module';

@Module({
  imports: [MongooseSchemaModule, DatabaseModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
