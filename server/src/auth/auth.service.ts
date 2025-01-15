import { TemporaryEmployee } from './../schema/temporary-employees.schema';
import { Employee } from './../schema/employee.schema';
import {
  Injectable,
  ConflictException,
  BadRequestException,
  HttpStatus,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/schema/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { catchError, firstValueFrom, timeout } from 'rxjs';
import { ResponseFormat } from '../interface';
import { JwtService } from '@nestjs/jwt';
import { TLoginResponse, TUser } from 'src/interface/auth';
import e from 'express';
import { IsNumber } from 'class-validator';

@Injectable()
export class AuthService {
  private readonly EXTERNAL_AUTH_TIMEOUT = 3000; // 3 seconds
  private readonly EXTERNAL_AUTH_ENDPOINT =
    'https://iot-west.sncformer.com/api/API_SAP_APP/auth/login_emp';
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Employee.name) private employeeModel: Model<Employee>,
    @InjectModel(TemporaryEmployee.name)
    private temporaryEmployeeModel: Model<TemporaryEmployee>,

    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<ResponseFormat<TLoginResponse>> {
    try {
      const hashedPassword = await this.hashPassword(loginDto.password);

      // Step 1: Try external authentication
      const externalAuth = await this.attemptExternalAuth(
        `${loginDto.employee_id}`,
        loginDto.password,
      );

      // Step 2: Find user data
      const { user, employee, temporaryEmployee } = await this.findUserData(
        loginDto.employee_id,
      );

      // Step 3: Create user if doesn't exist
      let currentUser: any = user;
      if (!user) {
        const newUser = await this.createUser({
          employee_id: loginDto.employee_id,
          password: hashedPassword,
        });
        currentUser = newUser.data;
      }

      // Step 4: Check password
      const passwordMatch = await this.comparePasswords(
        loginDto.password,
        currentUser.password,
      );

      // Step 5: Handle authentication result
      if (externalAuth.success || passwordMatch) {
        return this.handleSuccessfulAuth(
          currentUser,
          employee || temporaryEmployee,
          loginDto.password,
          hashedPassword,
          externalAuth.success,
        );
      }

      throw new HttpException(
        {
          status: 'error',
          message: 'Invalid credentials',
          data: [],
        },
        HttpStatus.UNAUTHORIZED,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Internal server error: ' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAllEmployee(): Promise<ResponseFormat<Employee[]>> {
    try {
      const Employee = await this.employeeModel.find();
      return {
        status: 'success',
        message: 'Users retrieved successfully',
        data: Employee,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to retrieve users',
        data: [],
      };
    }
  }

  async updateUser(
    id: string,
    updateData: Partial<CreateUserDto>,
  ): Promise<ResponseFormat<User>> {
    try {
      const user = await this.userModel.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      if (!user) {
        return {
          status: 'error',
          message: 'User not found',
          data: [],
        };
      }

      return {
        status: 'success',
        message: 'User updated successfully',
        data: user,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to update user',
        data: [],
      };
    }
  }

  async deleteUser(id: string): Promise<ResponseFormat<any>> {
    try {
      const result = await this.userModel.deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        return {
          status: 'error',
          message: 'User not found',
          data: null,
        };
      }

      return {
        status: 'success',
        message: 'User deleted successfully',
        data: result,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to delete user',
        data: null,
      };
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  private async comparePasswords(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private async createUser(userData: {
    employee_id: number;
    password: string;
  }): Promise<ResponseFormat<User>> {
    const newUser = await this.userModel.create({
      employee_id: userData.employee_id,
      password: userData.password,
      role: 'user', // Default role
    });

    return {
      status: 'success',
      message: 'User created successfully',
      data: newUser,
    };
  }

  private generateToken(user: any): string {
    const payload = {
      employee_id: user.employee_id,
      role: user.Auth,
    };
    return this.jwtService.sign(payload);
  }

  private async attemptExternalAuth(
    employeeId: string,
    password: string,
  ): Promise<{
    success: boolean;
    response?: TLoginResponse;
  }> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(this.EXTERNAL_AUTH_ENDPOINT, {
            Username: employeeId,
            Password: password,
          })
          .pipe(
            timeout(this.EXTERNAL_AUTH_TIMEOUT),
            catchError((error) => {
              console.log('External API error:', error.message);
              return [];
            }),
          ),
      );

      return {
        success: response?.data?.status === 'Yes',
        response: response?.data,
      };
    } catch (error) {
      return { success: false };
    }
  }

  private async findUserData(employeeId: number) {
    const [user, employee, temporaryEmployee] = await Promise.all([
      this.userModel.findOne({ employee_id: employeeId }),
      this.employeeModel.findOne({ employee_id: employeeId }),
      this.temporaryEmployeeModel.findOne({ employee_id: employeeId }),
    ]);

    if (!employee && !temporaryEmployee) {
      // console.log(employee, temporaryEmployee, user, employeeId);
      throw new HttpException(
        {
          status: 'error',
          message: 'User not found in database',
          data: [],
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return { user, employee, temporaryEmployee };
  }

  private async handleSuccessfulAuth(
    user: any,
    employee: TemporaryEmployee | Employee,
    password: string,
    hashedPassword: string,
    isExternalAuth: boolean,
  ): Promise<ResponseFormat<TLoginResponse>> {
    const token = this.generateToken(user);

    // Update password if external auth succeeded but local password doesn't match
    if (
      isExternalAuth &&
      !(await this.comparePasswords(password, user.password))
    ) {
      await this.userModel.findByIdAndUpdate(user._id, {
        password: hashedPassword,
      });
      // console.log('Password updated in local database');
    }
    const loginResponse: TLoginResponse = {
      employee_id: user.employee_id,
      role: user.role,
      full_name: `${employee.first_name} ${employee.last_name}`,
      position: employee.position,
      token,
    };
    return {
      status: 'success',
      message: `Login successful (${isExternalAuth ? 'external' : 'local'} auth)`,
      data: loginResponse,
    };
  }
}
