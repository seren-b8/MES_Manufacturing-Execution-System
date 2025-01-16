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

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard)
  async findAllUsers(): Promise<ResponseFormat<Employee[]>> {
    return this.authService.findAllEmployee();
  }

  @Put('users/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateUserDto>,
  ): Promise<ResponseFormat<User>> {
    return this.authService.updateUser(id, updateData);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param('id') id: string): Promise<ResponseFormat<any>> {
    return this.authService.deleteUser(id);
  }
}
