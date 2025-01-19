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
import { ConfigModule } from '@nestjs/config';
import { databaseConfig } from './config/database.config';

const validateConfig = (config: Record<string, unknown>) => {
  const requiredKeys = ['SECRET_KEY'];
  const missingKeys = requiredKeys.filter((key) => !config[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingKeys.join(', ')}`,
    );
  }
  return config;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      validate: validateConfig,
      envFilePath: '.env',
      cache: true,
    }),
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
export class AppModule {
  constructor() {
    // เพิ่ม logging เพื่อยืนยันการโหลด configuration
    console.log('Application configuration loaded successfully');
  }
}
