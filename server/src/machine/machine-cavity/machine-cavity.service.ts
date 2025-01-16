import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/interface';
import { MasterCavity } from 'src/schema/master-cavity.schema';
import { CreateMasterCavityDto } from '../dto/create-master-cavity.dto';

@Injectable()
export class MachineCavityService {
  constructor(
    @InjectModel(MasterCavity.name)
    private readonly machineCavityModel: Model<MasterCavity>,
  ) {}

  async findAll(query: any = {}): Promise<ResponseFormat<MasterCavity[]>> {
    try {
      const cavities = await this.machineCavityModel.find(query).lean();
      return {
        status: 'success',
        message: 'Retrieved machine cavities successfully',
        data: cavities,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve machine cavities: ' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<ResponseFormat<MasterCavity>> {
    try {
      const cavity = await this.machineCavityModel.findById(id).lean();

      if (!cavity) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine cavity not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Retrieved machine cavity successfully',
        data: cavity,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve machine cavity: ' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async create(
    createDto: CreateMasterCavityDto,
  ): Promise<ResponseFormat<MasterCavity>> {
    try {
      const newCavity = await this.machineCavityModel.create(createDto);
      return {
        status: 'success',
        message: 'Created machine cavity successfully',
        data: newCavity,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to create machine cavity: ' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    updateDto: any,
  ): Promise<ResponseFormat<MasterCavity>> {
    try {
      const updatedCavity = await this.machineCavityModel
        .findByIdAndUpdate(id, updateDto, { new: true })
        .lean();

      if (!updatedCavity) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine cavity not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Updated machine cavity successfully',
        data: updatedCavity,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update machine cavity: ' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<ResponseFormat<MasterCavity>> {
    try {
      const deletedCavity = await this.machineCavityModel
        .findByIdAndDelete(id)
        .lean();

      if (!deletedCavity) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine cavity not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Deleted machine cavity successfully',
        data: deletedCavity,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to delete machine cavity: ' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
