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
import { ResponseFormat } from 'src/interface';
import { QueryAssignEmployeeDto } from '../dto/query-assign-employee.dto';
import { UpdateAssignEmployeeDto } from '../dto/update-assign-employee.dto';
import { CreateAssignEmployeeDto } from '../dto/create-assign-eployee.dto';

@Controller('/assign-employee')
// @UseGuards(JwtAuthGuard)
export class AssignEmployeeController {
  constructor(private readonly assignEmployeeService: AssignEmployeeService) {}

  @Post()
  async createAssignment(
    @Body() createDto: CreateAssignEmployeeDto,
  ): Promise<ResponseFormat<any>> {
    return this.assignEmployeeService.createAssignment(createDto);
  }

  @Get()
  async findAll(
    @Query() queryDto: QueryAssignEmployeeDto,
  ): Promise<ResponseFormat<any>> {
    return this.assignEmployeeService.findAll(queryDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ResponseFormat<any>> {
    return this.assignEmployeeService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAssignEmployeeDto,
  ): Promise<ResponseFormat<any>> {
    return this.assignEmployeeService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ResponseFormat<any>> {
    return this.assignEmployeeService.remove(id);
  }

  @Put(':id/complete')
  async completeAssignment(
    @Param('id') id: string,
  ): Promise<ResponseFormat<any>> {
    return this.assignEmployeeService.updateStatus(id, 'completed');
  }

  @Put(':id/suspend')
  async suspendAssignment(
    @Param('id') id: string,
  ): Promise<ResponseFormat<any>> {
    return this.assignEmployeeService.updateStatus(id, 'suspended');
  }
}
