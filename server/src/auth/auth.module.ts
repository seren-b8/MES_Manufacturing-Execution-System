import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from '../shared/modules/schema/user.schema';
import {
  Employee,
  EmployeeSchema,
} from 'src/shared/modules/schema/employee.schema';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from 'src/shared/modules/database/database.module';
import { MongooseSchemaModule } from 'src/shared/modules/database/mongoose-schema.module';

@Module({
  imports: [
    // กำหนด default strategy เป็น jwt
    PassportModule.register({ defaultStrategy: 'jwt' }),
    HttpModule,
    MongooseSchemaModule,
    DatabaseModule,

    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('SECRET_KEY');

        // เพิ่มการตรวจสอบ secret
        if (!secret) {
          throw new Error('JWT SECRET_KEY is not defined');
        }

        // Log การตั้งค่าเพื่อการตรวจสอบ
        console.log('JWT Module Configuration:', {
          hasSecret: !!secret,
          secretLength: secret.length,
          expiresIn: '1d',
        });

        return {
          secret,
          signOptions: {
            expiresIn: '1d',
            algorithm: 'HS256', // ระบุ algorithm ที่ใช้
          },
          verifyOptions: {
            algorithms: ['HS256'], // ระบุ algorithm ที่ยอมรับ
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // เพิ่ม ConfigService เพื่อให้เข้าถึงได้ทั่วทั้งโมดูล
    ConfigService,
  ],
  exports: [AuthService],
})
export class AuthModule {
  constructor(private configService: ConfigService) {
    // ตรวจสอบการตั้งค่าเมื่อโมดูลเริ่มทำงาน
    const secret = this.configService.get<string>('SECRET_KEY');
    console.log('AuthModule initialized:', {
      hasSecret: !!secret,
      secretLength: secret?.length,
    });
  }
}
