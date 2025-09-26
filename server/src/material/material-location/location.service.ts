// src/material/material-location/location.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MaterialLocation } from '../../schema/material-location.schema';
import { CreateLocationDto } from '../dto/create-location.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { GeneratePositionCodeDto } from '../dto/position-code.dto';
import { ResponseFormat } from 'src/shared/interface';

@Injectable()
export class LocationService {
  constructor(
    @InjectModel(MaterialLocation.name)
    private readonly locationModel: Model<MaterialLocation>,
  ) {}

  async create(
    dto: CreateLocationDto,
  ): Promise<ResponseFormat<MaterialLocation>> {
    try {
      // Check if location_code already exists
      const existingLocation = await this.locationModel.findOne({
        location_code: dto.location_code.toUpperCase(),
      });

      if (existingLocation) {
        throw new ConflictException({
          status: 'error',
          message: 'Location code already exists',
          data: [],
        });
      }

      // Validate parent location if provided
      if (dto.parent_location_id) {
        const parentLocation = await this.locationModel.findById(
          dto.parent_location_id,
        );
        if (!parentLocation) {
          throw new BadRequestException({
            status: 'error',
            message: 'Parent location does not exist',
            data: [],
          });
        }

        // Check for circular reference
        if (
          await this.wouldCreateCircularReference(dto.parent_location_id, null)
        ) {
          throw new BadRequestException({
            status: 'error',
            message: 'Cannot create circular reference in location hierarchy',
            data: [],
          });
        }
      }

      // Validate position format if has_positions is true
      if (dto.has_positions && !dto.position_format) {
        throw new BadRequestException({
          status: 'error',
          message: 'Position format is required when has_positions is true',
          data: [],
        });
      }

      // If no position format provided, set has_positions to false
      if (!dto.position_format) {
        dto.has_positions = false;
      }

      const locationData = {
        ...dto,
        location_code: dto.location_code.toUpperCase(),
        parent_location_id: dto.parent_location_id
          ? new Types.ObjectId(dto.parent_location_id)
          : null,
        is_active: true,
      };

      const newLocation = new this.locationModel(locationData);
      const savedLocation = await newLocation.save();

      return {
        status: 'success',
        message: 'Location created successfully',
        data: [savedLocation],
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ConflictException({
        status: 'error',
        message: (error as Error).message || 'Failed to create location',
        data: [],
      });
    }
  }

  async findAll(): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const locations = await this.locationModel
        .find({ is_active: true })
        .populate(
          'parent_location_id',
          'location_name location_code location_type',
        )
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${locations.length} locations`,
        data: locations,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve locations',
        data: [],
      });
    }
  }

  async findById(id: string): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const location = await this.locationModel
        .findById(id)
        .populate(
          'parent_location_id',
          'location_name location_code location_type',
        )
        .populate(
          'child_locations',
          'location_name location_code location_type',
        )
        .exec();

      if (!location) {
        throw new NotFoundException({
          status: 'error',
          message: 'Location not found',
          data: [],
        });
      }

      return {
        status: 'success',
        message: 'Location retrieved successfully',
        data: [location],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve location',
        data: [],
      });
    }
  }

  async findByCode(code: string): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const location = await this.locationModel
        .findOne({
          location_code: code.toUpperCase(),
          is_active: true,
        })
        .populate(
          'parent_location_id',
          'location_name location_code location_type',
        )
        .exec();

      if (!location) {
        throw new NotFoundException({
          status: 'error',
          message: 'Location not found',
          data: [],
        });
      }

      return {
        status: 'success',
        message: 'Location retrieved successfully',
        data: [location],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve location',
        data: [],
      });
    }
  }

  async findByType(type: string): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const locations = await this.locationModel
        .find({
          location_type: type,
          is_active: true,
        })
        .populate(
          'parent_location_id',
          'location_name location_code location_type',
        )
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${locations.length} locations of type ${type}`,
        data: locations,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve locations by type',
        data: [],
      });
    }
  }

  async findWarehouses(): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const warehouses = await this.locationModel
        .find({
          location_type: 'warehouse',
          is_active: true,
        })
        .populate(
          'parent_location_id',
          'location_name location_code location_type',
        )
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${warehouses.length} warehouse locations`,
        data: warehouses,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve warehouse locations',
        data: [],
      });
    }
  }

  async findWithPositions(): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const locations = await this.locationModel
        .find({
          has_positions: true,
          is_active: true,
        })
        .populate(
          'parent_location_id',
          'location_name location_code location_type',
        )
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${locations.length} locations with positions`,
        data: locations,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve locations with positions',
        data: [],
      });
    }
  }

  async findByParent(
    parentId: string,
  ): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const childLocations = await this.locationModel
        .find({
          parent_location_id: new Types.ObjectId(parentId),
          is_active: true,
        })
        .populate(
          'parent_location_id',
          'location_name location_code location_type',
        )
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${childLocations.length} child locations`,
        data: childLocations,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve child locations',
        data: [],
      });
    }
  }

  async generatePositionCode(
    dto: GeneratePositionCodeDto,
  ): Promise<ResponseFormat<any>> {
    try {
      const location = await this.locationModel.findById(dto.location_id);

      if (!location) {
        throw new NotFoundException({
          status: 'error',
          message: 'Location not found',
          data: [],
        });
      }

      if (!location.has_positions || !location.position_format) {
        throw new BadRequestException({
          status: 'error',
          message: 'Location does not support positions',
          data: [],
        });
      }

      const positionCode = location.position_format
        .replace('{row}', dto.row)
        .replace('{column}', dto.column);

      return {
        status: 'success',
        message: 'Position code generated successfully',
        data: [
          {
            location_id: dto.location_id,
            position_code: positionCode,
            row: dto.row,
            column: dto.column,
          },
        ],
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to generate position code',
        data: [],
      });
    }
  }

  async update(
    id: string,
    dto: UpdateLocationDto,
  ): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const existingLocation = await this.locationModel.findById(id);
      if (!existingLocation) {
        throw new NotFoundException({
          status: 'error',
          message: 'Location not found',
          data: [],
        });
      }

      // Validate parent location if being updated
      if (dto.parent_location_id !== undefined) {
        if (dto.parent_location_id) {
          const parentLocation = await this.locationModel.findById(
            dto.parent_location_id,
          );
          if (!parentLocation) {
            throw new BadRequestException({
              status: 'error',
              message: 'Parent location does not exist',
              data: [],
            });
          }

          // Check for circular reference
          if (
            await this.wouldCreateCircularReference(dto.parent_location_id, id)
          ) {
            throw new BadRequestException({
              status: 'error',
              message: 'Cannot create circular reference in location hierarchy',
              data: [],
            });
          }
        }
      }

      // Validate position settings
      if (
        dto.has_positions === true &&
        !dto.position_format &&
        !existingLocation.position_format
      ) {
        throw new BadRequestException({
          status: 'error',
          message: 'Position format is required when has_positions is true',
          data: [],
        });
      }

      // If removing position format, set has_positions to false
      if (dto.position_format === null || dto.position_format === '') {
        dto.has_positions = false;
      }

      const updateData = {
        ...dto,
        parent_location_id: dto.parent_location_id
          ? new Types.ObjectId(dto.parent_location_id)
          : dto.parent_location_id === null
            ? null
            : existingLocation.parent_location_id,
      };

      const updatedLocation = await this.locationModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .populate(
          'parent_location_id',
          'location_name location_code location_type',
        )
        .exec();

      return {
        status: 'success',
        message: 'Location updated successfully',
        data: [updatedLocation],
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ConflictException({
        status: 'error',
        message: (error as Error).message || 'Failed to update location',
        data: [],
      });
    }
  }

  async delete(id: string): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const location = await this.locationModel.findById(id);
      if (!location) {
        throw new NotFoundException({
          status: 'error',
          message: 'Location not found',
          data: [],
        });
      }

      // Check if location has child locations
      const childCount = await this.locationModel.countDocuments({
        parent_location_id: new Types.ObjectId(id),
        is_active: true,
      });

      if (childCount > 0) {
        throw new ConflictException({
          status: 'error',
          message: 'Cannot delete location with child locations',
          data: [],
        });
      }

      // Soft delete - set is_active to false
      const deletedLocation = await this.locationModel
        .findByIdAndUpdate(id, { is_active: false }, { new: true })
        .exec();

      return {
        status: 'success',
        message: 'Location deleted successfully',
        data: [deletedLocation],
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new ConflictException({
        status: 'error',
        message: 'Failed to delete location',
        data: [],
      });
    }
  }

  async getMaterialsInLocation(
    locationId: string,
  ): Promise<ResponseFormat<any>> {
    try {
      // TODO: Implement when Material service is ready
      // This will query materials that have stock in this location

      return {
        status: 'success',
        message: 'Materials in location retrieved successfully',
        data: [], // Placeholder - will implement after Material service update
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve materials in location',
        data: [],
      });
    }
  }

  // Helper methods
  async validateLocationExists(locationId: string): Promise<boolean> {
    const location = await this.locationModel.findOne({
      _id: new Types.ObjectId(locationId),
      is_active: true,
    });
    return !!location;
  }

  async validateLocationSupportsPositions(
    locationId: string,
  ): Promise<boolean> {
    const location = await this.locationModel.findOne({
      _id: new Types.ObjectId(locationId),
      has_positions: true,
      is_active: true,
    });
    return !!location;
  }

  async getLocationInfo(locationId: string): Promise<MaterialLocation | null> {
    return await this.locationModel.findOne({
      _id: new Types.ObjectId(locationId),
      is_active: true,
    });
  }

  private async wouldCreateCircularReference(
    parentId: string,
    childId: string | null,
  ): Promise<boolean> {
    if (!parentId || !childId) return false;

    // Check if parentId is already a descendant of childId
    let currentParent = await this.locationModel.findById(parentId);

    while (currentParent && currentParent.parent_location_id) {
      if (currentParent.parent_location_id.toString() === childId) {
        return true; // Circular reference detected
      }
      currentParent = await this.locationModel.findById(
        currentParent.parent_location_id,
      );
    }

    return false;
  }

  async validatePositionFormat(format: string): Promise<boolean> {
    const pattern = /^[A-Z]-\{[a-z_]+\}-\{[a-z_]+\}$/;
    return pattern.test(format);
  }

  // Statistics methods
  async getLocationStats(): Promise<ResponseFormat<any>> {
    try {
      const stats = await this.locationModel.aggregate([
        { $match: { is_active: true } },
        {
          $group: {
            _id: '$location_type',
            count: { $sum: 1 },
            with_positions: { $sum: { $cond: ['$has_positions', 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const totalLocations = await this.locationModel.countDocuments({
        is_active: true,
      });
      const locationsWithPositions = await this.locationModel.countDocuments({
        has_positions: true,
        is_active: true,
      });

      return {
        status: 'success',
        message: 'Location statistics retrieved successfully',
        data: [
          {
            total_locations: totalLocations,
            locations_with_positions: locationsWithPositions,
            by_type: stats,
          },
        ],
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve location statistics',
        data: [],
      });
    }
  }
}
