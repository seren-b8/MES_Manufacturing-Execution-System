import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MaterialLocation } from 'src/schema/material-location.schema';
import { MaterialPosition } from 'src/schema/material-position.schema';
import { Material } from 'src/schema/material.schema';
import { ResponseFormat } from 'src/shared/interface';

@Injectable()
export class PositionService {
  constructor(
    @InjectModel(MaterialPosition.name)
    private positionModel: Model<MaterialPosition>,
    @InjectModel(MaterialLocation.name)
    private locationModel: Model<MaterialLocation>,
    @InjectModel(Material.name)
    private materialModel: Model<Material>,
  ) {}

  // ===== Query Methods =====

  async findAll(
    locationCode?: string,
  ): Promise<ResponseFormat<MaterialPosition>> {
    try {
      const filter: any = {};

      if (locationCode) {
        const location = await this.locationModel
          .findOne({ location_code: locationCode })
          .exec();

        if (!location) {
          throw new NotFoundException(`Location ${locationCode} not found`);
        }
        filter.location_id = location._id;
      }

      const positions = await this.positionModel
        .find(filter)
        .sort({ position_code: 1 })
        .populate('location_id', 'location_name location_code location_type')
        .exec();

      return {
        status: 'success',
        message: `Found ${positions.length} positions`,
        data: positions,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch positions: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findOne(positionId: string): Promise<ResponseFormat<MaterialPosition>> {
    try {
      if (!Types.ObjectId.isValid(positionId)) {
        throw new BadRequestException('Invalid position ID format');
      }

      const position = await this.positionModel
        .findById(positionId)
        .populate('location_id', 'location_name location_code location_type')
        .populate(
          'current_materials.material_id',
          'material_number material_description unit_of_measurement',
        )
        .exec();

      if (!position) {
        throw new NotFoundException(`Position with ID ${positionId} not found`);
      }

      return {
        status: 'success',
        message: 'Position retrieved successfully',
        data: [position],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch position: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findByCode(
    positionCode: string,
  ): Promise<ResponseFormat<MaterialPosition>> {
    try {
      const position = await this.positionModel
        .findOne({ position_code: positionCode })
        .populate('location_id', 'location_name location_code location_type')
        .populate(
          'current_materials.material_id',
          'material_number material_description',
        )
        .exec();

      if (!position) {
        throw new NotFoundException(`Position ${positionCode} not found`);
      }

      return {
        status: 'success',
        message: 'Position retrieved successfully',
        data: [position],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch position: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findAvailable(
    locationCode?: string,
  ): Promise<ResponseFormat<MaterialPosition>> {
    try {
      const filter: any = { is_occupied: false };

      if (locationCode) {
        const location = await this.locationModel
          .findOne({ location_code: locationCode })
          .exec();

        if (!location) {
          throw new NotFoundException(`Location ${locationCode} not found`);
        }
        filter.location_id = location._id;
      }

      const positions = await this.positionModel
        .find(filter)
        .sort({ position_code: 1 })
        .populate('location_id', 'location_name location_code')
        .exec();

      return {
        status: 'success',
        message: `Found ${positions.length} available positions`,
        data: positions,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch available positions: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findOccupied(
    locationCode?: string,
  ): Promise<ResponseFormat<MaterialPosition>> {
    try {
      const filter: any = { is_occupied: true };

      if (locationCode) {
        const location = await this.locationModel
          .findOne({ location_code: locationCode })
          .exec();

        if (!location) {
          throw new NotFoundException(`Location ${locationCode} not found`);
        }
        filter.location_id = location._id;
      }

      const positions = await this.positionModel
        .find(filter)
        .sort({ position_code: 1 })
        .populate('location_id', 'location_name location_code')
        .populate(
          'current_materials.material_id',
          'material_number material_description',
        )
        .exec();

      return {
        status: 'success',
        message: `Found ${positions.length} occupied positions`,
        data: positions,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch occupied positions: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Materials in Position =====

  async getMaterialsInPosition(
    positionCode: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const position: any = await this.positionModel
        .findOne({ position_code: positionCode })
        .populate('location_id', 'location_name location_code')
        .populate(
          'current_materials.material_id',
          'material_number material_description unit_of_measurement',
        )
        .exec();

      if (!position) {
        throw new NotFoundException(`Position ${positionCode} not found`);
      }

      const materials = position.current_materials.map((mat: any) => ({
        material_number: mat.material_id?.material_number,
        material_description: mat.material_id?.material_description,
        unit: mat.material_id?.unit_of_measurement,
        quantity: mat.quantity,
        lot_number: mat.lot_number,
      }));

      return {
        status: 'success',
        message: `Found ${materials.length} materials in position ${positionCode}`,
        data: materials,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch materials: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Utilization & Statistics =====

  async getPositionUtilization(
    positionCode: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const position: any = await this.positionModel
        .findOne({ position_code: positionCode })
        .populate('location_id', 'location_name location_code')
        .exec();

      if (!position) {
        throw new NotFoundException(`Position ${positionCode} not found`);
      }

      const totalQuantity = position.current_materials.reduce(
        (sum: number, mat: any) => sum + mat.quantity,
        0,
      );

      const utilization: any = {
        position_code: position.position_code,
        location_code: position.location_id?.location_code,
        location_name: position.location_id?.location_name,
        shelf_code: position.shelf_code,
        row: position.row,
        column: position.column,
        is_occupied: position.is_occupied,
        total_materials: position.current_materials.length,
        total_quantity: totalQuantity,
      };

      if (position.max_capacity) {
        utilization.max_capacity = position.max_capacity;
        utilization.available_capacity = position.max_capacity - totalQuantity;
        utilization.utilization_percentage = (
          (totalQuantity / position.max_capacity) *
          100
        ).toFixed(2);
      }

      return {
        status: 'success',
        message: 'Position utilization retrieved successfully',
        data: [utilization],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to get utilization: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Search & Filter =====

  async searchPositions(
    searchQuery: string,
  ): Promise<ResponseFormat<MaterialPosition>> {
    try {
      const positions = await this.positionModel
        .find({
          position_code: { $regex: searchQuery, $options: 'i' },
        })
        .limit(20)
        .populate('location_id', 'location_name location_code')
        .exec();

      return {
        status: 'success',
        message: `Found ${positions.length} positions matching "${searchQuery}"`,
        data: positions,
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Search failed: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findByShelf(
    shelfCode: string,
    locationCode?: string,
  ): Promise<ResponseFormat<MaterialPosition>> {
    try {
      const filter: any = { shelf_code: shelfCode };

      if (locationCode) {
        const location = await this.locationModel
          .findOne({ location_code: locationCode })
          .exec();

        if (location) {
          filter.location_id = location._id;
        }
      }

      const positions = await this.positionModel
        .find(filter)
        .sort({ row: 1, column: 1 })
        .populate('location_id', 'location_name location_code')
        .exec();

      return {
        status: 'success',
        message: `Found ${positions.length} positions in shelf ${shelfCode}`,
        data: positions,
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch positions: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Helper Methods =====

  async validatePositionExists(
    positionCode: string,
  ): Promise<MaterialPosition> {
    const position = await this.positionModel
      .findOne({ position_code: positionCode })
      .exec();

    if (!position) {
      throw new NotFoundException(`Position ${positionCode} not found`);
    }

    return position;
  }
}
