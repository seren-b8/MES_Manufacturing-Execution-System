import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { DatabaseModule } from 'src/database/database.module';
import { MongooseSchemaModule } from 'src/database/mongoose-schema.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [MongooseSchemaModule, DatabaseModule, AuthModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
