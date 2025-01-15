import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from '../schema/user.schema';
import { Employee, EmployeeSchema } from 'src/schema/employee.schema';
import { HttpModule } from '@nestjs/axios';
import {
  TemporaryEmployee,
  TemporaryEmployeeSchema,
} from 'src/schema/temporary-employees.schema';

@Module({
  imports: [
    PassportModule,
    HttpModule,
    // เพิ่ม MongooseModule.forFeature
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: TemporaryEmployee.name, schema: TemporaryEmployeeSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('SECRET_KEY'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
