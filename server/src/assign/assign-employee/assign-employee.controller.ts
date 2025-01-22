import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { AssignEmployeeService } from './assign-employee.service';
import {
  CloseByUserDto,
  CreateAssignEmployeeDto,
  UpdateAssignEmployeeDto,
} from '../dto/assign-employee.dto';
import { ResponseFormat } from 'src/shared/interface';
import { AssignEmployee } from 'src/shared/modules/schema/assign-employee.schema';

@Controller('assign-employee')
@UseGuards(JwtAuthGuard)
export class AssignEmployeeController {
  constructor(private readonly assignEmployeeService: AssignEmployeeService) {}

  @Post()
  async create(@Body() createDto: CreateAssignEmployeeDto) {
    return await this.assignEmployeeService.create(createDto);
  }

  @Get('order/:assignOrderId')
  async findByAssignOrder(@Param('assignOrderId') assignOrderId: string) {
    return await this.assignEmployeeService.findByAssignOrder(assignOrderId);
  }

  @Get('user/:userId/active')
  async findActiveByUser(@Param('userId') userId: string) {
    return await this.assignEmployeeService.findActiveByUser(userId);
  }

  @Put('close-by-user')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true }))
  async closeByUser(
    @Body() closeByUserDto: CloseByUserDto,
  ): Promise<ResponseFormat<AssignEmployee>> {
    return await this.assignEmployeeService.closeByUser(closeByUserDto);
  }
}
