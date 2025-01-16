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
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { catchError, firstValueFrom, timeout } from 'rxjs';
import { ResponseFormat } from '../interface';
import { JwtService } from '@nestjs/jwt';
import { TLoginResponse, TUser } from 'src/interface/auth';
import { CreateUserDto } from './dto/create-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateTempEmployeeDto } from './dto/create-temp-employee.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import e from 'express';

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
        loginDto.employee_id,
        loginDto.password,
      );

      // Step 2: Find user data
      const { user, employee, temporaryEmployee } = await this.findUserData(
        loginDto.employee_id,
      );

      // Step 3: Create user if doesn't exist
      let currentUser: any = user;
      if (!user) {
        throw new HttpException(
          {
            status: 'error',
            message: 'User not found',
            data: [],
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (user.role === 'block') {
        throw new HttpException(
          {
            status: 'error',
            message: 'User is blocked',
            data: [],
          },
          HttpStatus.UNAUTHORIZED,
        );
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
      const employees = await this.employeeModel.aggregate([
        {
          $lookup: {
            from: 'users', // collection name
            localField: 'employee_id', // field from employee collection
            foreignField: 'employee_id', // field from users collection
            as: 'user_data', // alias for the joined data
          },
        },
        {
          $unwind: {
            path: '$user_data',
            preserveNullAndEmptyArrays: true, // keep employees even if they don't have user accounts
          },
        },
        {
          $project: {
            employee_id: 1,
            prior_name: 1,
            first_name: 1,
            last_name: 1,
            section: 1,
            department: 1,
            position: 1,
            company_code: 1,
            resign_status: 1,
            job_start: 1,
            role: {
              $ifNull: ['$user_data.role', null], // MongoDB's way of handling null coalescing
            }, // include user role
            // exclude password for security
          },
        },
      ]);
      return {
        status: 'success',
        message: 'Users retrieved successfully',
        data: employees,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
      return {
        status: 'error',
        message: 'Failed to retrieve users',
        data: [],
      };
    }
  }

  async createTempEmpolyee(
    createTempEmployeeDto: CreateTempEmployeeDto,
  ): Promise<ResponseFormat<TemporaryEmployee>> {
    try {
      const employee = await this.employeeModel.findOne({
        employee_id: createTempEmployeeDto.employee_id,
      });

      if (employee) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Employee already exists',
            data: [],
          },
          HttpStatus.CONFLICT,
        );
      }

      const tempEmployee = await this.temporaryEmployeeModel.findOne({
        employee_id: createTempEmployeeDto.employee_id,
      });

      if (tempEmployee) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Employee already exists',
            data: [],
          },
          HttpStatus.CONFLICT,
        );
      }

      const newTempEmployee = await this.temporaryEmployeeModel.create(
        createTempEmployeeDto,
      );
      return {
        status: 'success',
        message: 'Temporary employee created successfully',
        data: newTempEmployee,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to create temporary employee :' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAllTemporaryEmployee(): Promise<
    ResponseFormat<TemporaryEmployee[]>
  > {
    try {
      const employees = await this.temporaryEmployeeModel.aggregate([
        {
          $lookup: {
            from: 'users', // collection name
            localField: 'employee_id', // field from employee collection
            foreignField: 'employee_id', // field from users collection
            as: 'user_data', // alias for the joined data
          },
        },
        {
          $unwind: {
            path: '$user_data',
            preserveNullAndEmptyArrays: true, // keep employees even if they don't have user accounts
          },
        },
        {
          $project: {
            employee_id: 1,
            prior_name: 1,
            first_name: 1,
            last_name: 1,
            section: 1,
            department: 1,
            position: 1,
            company_code: 1,
            resign_status: 1,
            job_start: 1,
            role: {
              $ifNull: ['$user_data.role', null], // MongoDB's way of handling null coalescing
            }, // include user role
            // exclude password for security
          },
        },
      ]);
      return {
        status: 'success',
        message: 'Users retrieved successfully',
        data: employees,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
      return {
        status: 'error',
        message: 'Failed to retrieve users',
        data: [],
      };
    }
  }

  async updateUser(
    updateData: Partial<UpdateRoleDto>,
  ): Promise<ResponseFormat<Partial<User>[]>> {
    try {
      const [user, employee, temporaryEmployee] = await Promise.all([
        this.userModel.findOne({ employee_id: updateData.employee_id }),
        this.employeeModel.findOne({
          employee_id: updateData.employee_id,
        }),
        this.temporaryEmployeeModel.findOne({
          employee_id: updateData.employee_id,
        }),
      ]);

      if (!employee && !temporaryEmployee) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Employee not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (!user) {
        throw new HttpException(
          {
            status: 'error',
            message: 'User not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const updateUser = await this.userModel.findByIdAndUpdate(user.id, {
        role: updateData.role,
      });

      if (!updateUser) {
        throw new HttpException(
          {
            status: 'error',
            message: 'update failed',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const userWithoutPassword = {
        _id: updateUser._id,
        employee_id: updateUser.employee_id,
        role: updateUser.role,
        external_auth: updateUser.external_auth,
      };

      return {
        status: 'success',
        message: 'User updated successfully',
        data: [userWithoutPassword],
      };

      // return this.userModel.findByIdAndUpdate
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update user :' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async changePassword(
    ChangePasswordDto: ChangePasswordDto,
  ): Promise<ResponseFormat<User>> {
    try {
      const user = await this.userModel.findOne({
        employee_id: ChangePasswordDto.employee_id,
      });

      if (!user) {
        throw new HttpException(
          {
            status: 'error',
            message: 'User not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (user.role === 'block') {
        throw new HttpException(
          {
            status: 'error',
            message: 'User is blocked',
            data: [],
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (user.external_auth) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Cannot change password for external users',
            data: [],
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (
        !(await this.comparePasswords(
          ChangePasswordDto.old_password,
          user.password,
        ))
      ) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Old password is incorrect',
            data: [],
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      const hashedPassword = await this.hashPassword(
        ChangePasswordDto.new_password,
      );

      const updateUser = await this.userModel.findByIdAndUpdate(user.id, {
        password: hashedPassword,
      });

      if (!updateUser) {
        return {
          status: 'error',
          message: 'User not found',
          data: [],
        };
      }

      return {
        status: 'success',
        message: 'Password updated successfully',
        data: updateUser,
      };

      // return this.userModel.findByIdAndUpdate
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update password',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
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

  async createUser(
    CreateUserDto: CreateUserDto,
  ): Promise<ResponseFormat<Partial<User>[]>> {
    try {
      // Check employee and temporary employee
      const [employee, temporaryEmployee] = await Promise.all([
        this.employeeModel.findOne({ employee_id: CreateUserDto.employee_id }),
        this.temporaryEmployeeModel.findOne({
          employee_id: CreateUserDto.employee_id,
        }),
      ]);

      if (!employee && !temporaryEmployee) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Employee not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if user exists
      const userExists = await this.userModel.findOne({
        employee_id: CreateUserDto.employee_id,
      });

      if (userExists) {
        throw new HttpException(
          {
            status: 'error',
            message: 'User already exists',
            data: [],
          },
          HttpStatus.CONFLICT,
        );
      }

      const newUser = await this.userModel.create({
        employee_id: CreateUserDto.employee_id,
        password: await this.hashPassword('0000'),
        role: CreateUserDto.role, // Default role
        external_auth: false,
      });

      const userWithoutPassword = {
        _id: newUser._id,
        employee_id: newUser.employee_id,
        role: newUser.role,
        external_auth: newUser.external_auth,
      };

      return {
        status: 'success',
        message: 'User created successfully',
        data: [userWithoutPassword],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
      throw new HttpException(
        {
          status: 'error',
          message: error.message || 'Failed to create user',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private generateToken(user: User): string {
    const payload = {
      employee_id: user.employee_id,
      sub: user._id,
      role: user.role,
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

  private async findUserData(employeeId: string) {
    const [user, employee, temporaryEmployee] = await Promise.all([
      this.userModel.findOne({ employee_id: employeeId }),
      this.employeeModel.findOne({
        employee_id: employeeId,
      }),
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
        external_auth: true,
      });
      // console.log('Password updated in local database');
    }
    const loginResponse: TLoginResponse = {
      employee_id: user.employee_id,
      role: user.role,
      full_name: `${employee.first_name} ${employee.last_name}`,
      position: employee.position,
      external_auth: user.external_auth,
      token,
    };
    return {
      status: 'success',
      message: `Login successful (${isExternalAuth ? 'external' : 'local'} auth)`,
      data: loginResponse,
    };
  }
}
