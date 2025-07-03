// co-product/co-product.controller.ts
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
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { CoProductService } from './co-product.service';
import { CreateCoProductDto } from '../dto/co-product.dto';

@Controller('co-products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoProductController {
  constructor(private readonly coProductService: CoProductService) {}

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  async createCoProduct(@Body() createCoProductDto: CreateCoProductDto) {
    return this.coProductService.createCoProductRecord(createCoProductDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getCoProducts(
    @Query('assign_order_id') assignOrderId?: string,
    @Query('material_number') materialNumber?: string,
  ) {
    return this.coProductService.getCoProductRecords(
      assignOrderId,
      materialNumber,
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getCoProduct(@Param('id') id: string) {
    return this.coProductService.getCoProductRecord(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async updateCoProduct(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateCoProductDto>,
  ) {
    return this.coProductService.updateCoProductRecord(id, updateData);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteCoProduct(@Param('id') id: string) {
    return this.coProductService.deleteCoProductRecord(id);
  }

  @Get('check/:assignOrderId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async checkCoProductAvailable(@Param('assignOrderId') assignOrderId: string) {
    const result =
      await this.coProductService.checkCoProductAvailable(assignOrderId);
    return {
      status: 'success',
      message: 'Co-product availability checked',
      data: [result],
    };
  }
}
