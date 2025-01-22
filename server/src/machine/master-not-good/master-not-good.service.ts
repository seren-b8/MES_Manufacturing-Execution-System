import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MasterNotGood } from 'src/shared/modules/schema/master-not-good.schema';
import {
  CreateMasterNotGoodDto,
  UpdateMasterNotGoodDto,
} from '../dto/master-not-good.dto';

@Injectable()
export class MasterNotGoodService {
  constructor(
    @InjectModel(MasterNotGood.name)
    private readonly masterNotGoodModel: Model<MasterNotGood>,
  ) {}

  async findAll(): Promise<MasterNotGood[]> {
    return this.masterNotGoodModel.find().exec();
  }

  async findOne(id: string): Promise<MasterNotGood> {
    return this.masterNotGoodModel.findById(id).exec();
  }

  async create(createDto: CreateMasterNotGoodDto): Promise<MasterNotGood> {
    const createdItem = new this.masterNotGoodModel(createDto);
    return createdItem.save();
  }

  async update(
    id: string,
    updateDto: UpdateMasterNotGoodDto,
  ): Promise<MasterNotGood> {
    return this.masterNotGoodModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
  }

  async remove(id: string): Promise<MasterNotGood> {
    return this.masterNotGoodModel.findByIdAndDelete(id).exec();
  }
}
