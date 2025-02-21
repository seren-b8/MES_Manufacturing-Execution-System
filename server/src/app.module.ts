import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/modules/database/database.module';
import { MongooseSchemaModule } from './shared/modules/database/mongoose-schema.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssignModule } from './assign/assign.module';
import { EmployeeModule } from './employee/employee.module';
import { MachineModule } from './machine/machine.module';
import { ProductionModule } from './production/production.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { databaseConfig } from './shared/config/database.config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './auth/guard/custom-throttler.guard';
import { MesCacheModule } from './shared/modules/cache/cache.module';

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
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      validate: validateConfig,
      envFilePath: '.env',
      cache: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // เป็นมิลลิวินาที (60 วินาที)
        limit: 500, // จำกัดการเรียกใช้งาน 50 ครั้ง
      },
    ]),
    DatabaseModule,
    MongooseSchemaModule,
    AssignModule,
    EmployeeModule,
    MachineModule,
    ProductionModule,
    AuthModule,
    MesCacheModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'APP_GUARD',
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {
  constructor() {
    // เพิ่ม logging เพื่อยืนยันการโหลด configuration
    console.log('Application configuration loaded successfully');
  }
}
