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
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { AssignEmployeeService } from './assign-employee.service';
import {
  CreateAssignEmployeeDto,
  UpdateAssignEmployeeDto,
} from '../dto/assign-employee.dto';

@Controller('/assign-employee')
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

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAssignEmployeeDto,
  ) {
    return await this.assignEmployeeService.update(id, updateDto);
  }

  @Put('order/:assignOrderId/close')
  async closeByAssignOrder(@Param('assignOrderId') assignOrderId: string) {
    return await this.assignEmployeeService.closeByAssignOrder(assignOrderId);
  }
}
