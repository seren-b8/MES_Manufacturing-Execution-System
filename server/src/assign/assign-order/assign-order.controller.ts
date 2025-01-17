import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  Put,
} from '@nestjs/common';
import { AssignOrderService } from './assign-order.service';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ResponseFormat } from 'src/interface';
import {
  CreateAssignOrderDto,
  UpdateAssignOrderDto,
} from '../dto/assign-order.dto';

@Controller('/assign-orders')
export class AssignOrderController {
  constructor(private readonly assignOrderService: AssignOrderService) {}

  @Post()
  async create(@Body() createDto: CreateAssignOrderDto) {
    return await this.assignOrderService.create(createDto);
  }

  @Get()
  async findAll(
    @Query('machine_number') machine_number?: string,
    @Query('status') status?: string,
  ) {
    return await this.assignOrderService.findAll(machine_number, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.assignOrderService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAssignOrderDto,
  ) {
    return await this.assignOrderService.update(id, updateDto);
  }
}
