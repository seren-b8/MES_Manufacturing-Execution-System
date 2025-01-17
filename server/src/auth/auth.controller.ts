import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Put,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { User } from 'src/schema/user.schema';
import { Employee } from 'src/schema/employee.schema';
import { LoginDto } from './dto/login.dto';
import { ResponseFormat } from '../interface';
import { TLoginResponse } from 'src/interface/auth';
import { use } from 'passport';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateTempEmployeeDto } from './dto/create-temp-employee.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './enum/roles.enum';
import { RolesGuard } from './guard/roles.guard';
import { Roles } from './decorator/roles.decorator';
import e from 'express';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() LoginDto: LoginDto,
  ): Promise<ResponseFormat<TLoginResponse>> {
    return this.authService.login(LoginDto);
  }

  @Get('get-employee')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async findAllUsers(): Promise<ResponseFormat<Employee[]>> {
    return this.authService.findAllEmployee();
  }

  @Post('create-temp-employee')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async createTempEmployee(
    @Body() createTempEmployeeDto: CreateTempEmployeeDto,
  ): Promise<ResponseFormat<Employee[]>> {
    return this.authService.createTempEmpolyee(createTempEmployeeDto);
  }

  // @Get('get-temp-employee')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN)
  // @HttpCode(HttpStatus.OK)
  // async findAllTempUsers(): Promise<ResponseFormat<T>> {
  //   return this.authService.findAllTemporaryEmployee();
  // }

  @Post('create-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<ResponseFormat<Partial<User>[]>> {
    return this.authService.createUser(createUserDto);
  }

  @Put('update-role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateUser(
    @Body() updateData: Partial<UpdateRoleDto>,
  ): Promise<ResponseFormat<Partial<User>[]>> {
    return this.authService.updateUser(updateData);
  }

  @Put('update-change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async updatePassword(
    @Body()
    ChangePasswordDto: ChangePasswordDto,
  ): Promise<ResponseFormat<User[]>> {
    return this.authService.changePassword(ChangePasswordDto);
  }

  @Delete('delete-users/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteUser(@Param('id') id: string): Promise<ResponseFormat<any>> {
    return this.authService.deleteUser(id);
  }
}
