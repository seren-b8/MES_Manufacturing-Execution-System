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
import { ResponseFormat } from '../shared/interface';
import { TLoginResponse } from 'src/shared/interface/auth';
import { use } from 'passport';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateTempEmployeeDto } from './dto/create-temp-employee.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './enum/roles.enum';
import { RolesGuard } from './guard/roles.guard';
import { Roles } from './decorator/roles.decorator';
import e from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { GetUserId } from './decorator/get-current-user.decorator';

@Controller('/auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 200, ttl: 60000 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() LoginDto: LoginDto,
  ): Promise<ResponseFormat<TLoginResponse>> {
    return this.authService.login(LoginDto);
  }

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
    @GetUserId() userId: string,
  ): Promise<ResponseFormat<User[]>> {
    return this.authService.changePassword(ChangePasswordDto, userId);
  }

  // @Delete('delete-users/:id')
  // @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN)
  // async deleteUser(@Param('id') id: string): Promise<ResponseFormat<any>> {
  //   return this.authService.deleteUser(id);
  // }
}
