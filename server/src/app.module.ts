import { Module } from '@nestjs/common';
import { DatabaseModule } from './modules/database/database.module';
import { MongooseSchemaModule } from './modules/database/mongoose-schema.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssignModule } from './assign/assign.module';
import { EmployeeModule } from './employee/employee.module';
import { MachineModule } from './machine/machine.module';
import { ProductionModule } from './production/production.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    MongooseSchemaModule,
    AssignModule,
    EmployeeModule,
    MachineModule,
    ProductionModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
