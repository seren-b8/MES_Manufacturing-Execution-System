import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MasterNotGoodService } from './master-not-good.service';
import {
  CreateMasterNotGoodDto,
  UpdateMasterNotGoodDto,
} from '../dto/master-not-good.dto';
import { ResponseFormat } from 'src/shared/interface';
import { MasterNotGood } from 'src/shared/modules/schema/master-not-good.schema';

@Controller('master-not-good')
export class MasterNotGoodController {
  constructor(private readonly masterNotGoodService: MasterNotGoodService) {}

  @Get()
  async findAll(): Promise<ResponseFormat<MasterNotGood>> {
    const items = await this.masterNotGoodService.findAll();
    return {
      status: 'success',
      message: 'Master not good items retrieved successfully',
      data: items,
    };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ): Promise<ResponseFormat<MasterNotGood>> {
    const item = await this.masterNotGoodService.findOne(id);
    if (!item) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Item not found',
          data: [],
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      status: 'success',
      message: 'Master not good item retrieved successfully',
      data: [item],
    };
  }

  @Post()
  async create(
    @Body() createDto: CreateMasterNotGoodDto,
  ): Promise<ResponseFormat<MasterNotGood>> {
    const item = await this.masterNotGoodService.create(createDto);
    return {
      status: 'success',
      message: 'Master not good item created successfully',
      data: [item],
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMasterNotGoodDto,
  ): Promise<ResponseFormat<MasterNotGood>> {
    const item = await this.masterNotGoodService.update(id, updateDto);
    if (!item) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Item not found',
          data: [],
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      status: 'success',
      message: 'Master not good item updated successfully',
      data: [item],
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ResponseFormat<null>> {
    const result = await this.masterNotGoodService.remove(id);
    if (!result) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Item not found',
          data: [],
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      status: 'success',
      message: 'Master not good item deleted successfully',
      data: [],
    };
  }
}
