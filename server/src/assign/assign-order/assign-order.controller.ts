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
} from '@nestjs/common';
import { AssignOrderService } from './assign-order.service';
import { CreateAssignOrderDto } from '../dto/create-assign-order.dto';
import { UpdateAssignOrderDto } from '../dto/update-assign-order-dto';
import { AssignOrder } from 'src/schema/assign-order.schema';
import { ResponseFormat } from 'src/interface';

@Controller('/assign-orders')
export class AssignOrderController {
  constructor(private readonly assignOrderService: AssignOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @Body() createAssignOrderDto: CreateAssignOrderDto,
  ): Promise<ResponseFormat<AssignOrder[]>> {
    return this.assignOrderService.create(createAssignOrderDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query(new ValidationPipe({ transform: true })) query: any,
  ): Promise<ResponseFormat<AssignOrder[]>> {
    return this.assignOrderService.findAll(query);
  }

  @Get('machine/:machineNumber')
  @HttpCode(HttpStatus.OK)
  async findByMachine(
    @Param('machineNumber') machineNumber: string,
  ): Promise<ResponseFormat<AssignOrder[]>> {
    return this.assignOrderService.findByMachine(machineNumber);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<ResponseFormat<AssignOrder>> {
    return this.assignOrderService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('id') id: string,
    @Body() updateAssignOrderDto: UpdateAssignOrderDto,
  ): Promise<ResponseFormat<AssignOrder>> {
    return this.assignOrderService.update(id, updateAssignOrderDto);
  }

  @Patch(':id/production-count')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateProductionCount(
    @Param('id') id: string,
    @Body('actualQuantity') actualQuantity: number,
    @Body('scrapQuantity') scrapQuantity: number,
  ): Promise<ResponseFormat<AssignOrder>> {
    return this.assignOrderService.updateProductionCount(
      id,
      actualQuantity,
      scrapQuantity,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<ResponseFormat<[]>> {
    return this.assignOrderService.remove(id);
  }
}
