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

import { ResponseFormat } from 'src/shared/interface';
import { Material } from 'src/schema/material.schema';
import { QueryLocationDto } from './dto/query-location.dto';
import { LocationMaterialDto } from './dto/location-materials-response.dto';

@Injectable()
export class LocationService {
  constructor(
    @InjectModel(MaterialLocation.name)
    private readonly locationModel: Model<MaterialLocation>,
    @InjectModel(Material.name)
    private materialModel: Model<Material>,
  ) {}

  async findAll(
    query: QueryLocationDto,
  ): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const {
        location_type,
        location_code,
        is_active = true,
        has_positions,
      } = query;

      // Build filter
      const filter: any = {};

      if (location_type) {
        filter.location_type = location_type;
      }

      if (location_code) {
        filter.location_code = { $regex: location_code, $options: 'i' };
      }

      if (is_active !== undefined) {
        filter.is_active = is_active;
      }

      if (has_positions !== undefined) {
        filter.has_positions = has_positions;
      }

      // Execute query
      const locations = await this.locationModel
        .find(filter)
        .sort({ location_code: 1 })
        .populate('parent_location_id', 'location_name location_code')
        .exec();

      return {
        status: 'success',
        message: `Found ${locations.length} locations`,
        data: locations,
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch locations: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findOne(locationId: string): Promise<ResponseFormat<MaterialLocation>> {
    try {
      if (!Types.ObjectId.isValid(locationId)) {
        throw new BadRequestException('Invalid location ID format');
      }

      const location = await this.locationModel
        .findById(locationId)
        .populate(
          'parent_location_id',
          'location_name location_code location_type',
        )
        .exec();

      if (!location) {
        throw new NotFoundException(`Location with ID ${locationId} not found`);
      }

      return {
        status: 'success',
        message: 'Location retrieved successfully',
        data: [location],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch location: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findByCode(
    locationCode: string,
  ): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const location = await this.locationModel
        .findOne({ location_code: locationCode })
        .populate('parent_location_id', 'location_name location_code')
        .exec();

      if (!location) {
        throw new NotFoundException(`Location ${locationCode} not found`);
      }

      return {
        status: 'success',
        message: 'Location retrieved successfully',
        data: [location],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch location: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findByType(
    locationType: string,
  ): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const validTypes = [
        'warehouse',
        'production',
        'machine',
        'scrap',
        'quarantine',
        'staging',
      ];

      if (!validTypes.includes(locationType)) {
        throw new BadRequestException(
          `Invalid location type. Must be one of: ${validTypes.join(', ')}`,
        );
      }

      const locations = await this.locationModel
        .find({
          location_type: locationType,
          is_active: true,
        })
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${locations.length} ${locationType} locations`,
        data: locations,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch locations: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Materials in Location =====

  async getMaterialsInLocation(
    locationCode: string,
  ): Promise<ResponseFormat<LocationMaterialDto>> {
    try {
      // Validate location exists
      const location = await this.validateLocationExists(locationCode);

      // Find all materials that have stock in this location
      const materials = await this.materialModel
        .find({
          'current_stock.location_id': location._id,
        })
        .populate('current_stock.location_id', 'location_code')
        .populate('current_stock.position_id', 'position_code')
        .exec();

      // Extract stock info for this specific location
      const locationMaterials: LocationMaterialDto[] = [];

      materials.forEach((material: any) => {
        const stocksInLocation = material.current_stock.filter(
          (stock: any) =>
            stock.location_id?._id.toString() === location._id.toString(),
        );

        stocksInLocation.forEach((stock: any) => {
          locationMaterials.push({
            material_number: material.material_number,
            material_description: material.material_description,
            quantity: stock.stock_quantity,
            position_code: stock.position_id?.position_code,
            lot_number: stock.lot_number,
          });
        });
      });

      return {
        status: 'success',
        message: `Found ${locationMaterials.length} materials in location ${locationCode}`,
        data: locationMaterials,
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

  async getLocationUtilization(
    locationCode: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const location = await this.validateLocationExists(locationCode);

      // Get materials in location
      const materials = await this.materialModel
        .find({
          'current_stock.location_id': location._id,
        })
        .exec();

      let totalMaterials = 0;
      let totalQuantity = 0;

      materials.forEach((material: any) => {
        const stocksInLocation = material.current_stock.filter(
          (stock: any) =>
            stock.location_id.toString() === location._id.toString(),
        );

        if (stocksInLocation.length > 0) {
          totalMaterials++;
          stocksInLocation.forEach((stock: any) => {
            totalQuantity += stock.stock_quantity;
          });
        }
      });

      const utilization: any = {
        location_code: locationCode,
        location_name: location.location_name,
        location_type: location.location_type,
        total_materials: totalMaterials,
        total_quantity: totalQuantity,
      };

      // If location has positions, get position utilization
      if (location.has_positions) {
        const positions = await this.locationModel.db
          .collection('material_position')
          .find({ location_id: location._id })
          .toArray();

        const occupiedPositions = positions.filter(
          (pos: any) =>
            pos.is_occupied === true || pos.current_materials?.length > 0,
        ).length;

        utilization.total_positions = positions.length;
        utilization.occupied_positions = occupiedPositions;
        utilization.available_positions = positions.length - occupiedPositions;
        utilization.utilization_percentage =
          positions.length > 0
            ? ((occupiedPositions / positions.length) * 100).toFixed(2)
            : 0;
      }

      return {
        status: 'success',
        message: 'Location utilization retrieved successfully',
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

  // ===== Helper Methods =====

  async validateLocationExists(
    locationCode: string,
  ): Promise<MaterialLocation> {
    const location = await this.locationModel
      .findOne({
        location_code: locationCode,
        is_active: true,
      })
      .exec();

    if (!location) {
      throw new NotFoundException(
        `Location ${locationCode} not found or inactive`,
      );
    }

    return location;
  }

  async isMachineLocation(locationCode: string): Promise<boolean> {
    try {
      const location = await this.locationModel
        .findOne({ location_code: locationCode })
        .exec();

      if (!location) {
        return false;
      }

      return location.location_type === 'machine';
    } catch (error) {
      return false;
    }
  }

  // ===== Quick Lookups =====

  async getWarehouses(): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const warehouses = await this.locationModel
        .find({
          location_type: 'warehouse',
          is_active: true,
        })
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${warehouses.length} warehouses`,
        data: warehouses,
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch warehouses: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async getProductionAreas(): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const productionAreas = await this.locationModel
        .find({
          location_type: 'production',
          is_active: true,
        })
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${productionAreas.length} production areas`,
        data: productionAreas,
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch production areas: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async getMachineLocations(): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const machines = await this.locationModel
        .find({
          location_type: 'machine',
          is_active: true,
        })
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${machines.length} machine locations`,
        data: machines,
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch machine locations: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async getLocationsWithPositions(): Promise<ResponseFormat<MaterialLocation>> {
    try {
      const locations = await this.locationModel
        .find({
          has_positions: true,
          is_active: true,
        })
        .sort({ location_code: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${locations.length} locations with positions`,
        data: locations,
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch locations: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Statistics =====

  async getLocationSummary(): Promise<ResponseFormat<any>> {
    try {
      const locations = await this.locationModel
        .find({ is_active: true })
        .exec();

      const summary = {
        total_locations: locations.length,
        by_type: {
          warehouse: 0,
          production: 0,
          machine: 0,
          scrap: 0,
          quarantine: 0,
          staging: 0,
        },
        with_positions: 0,
        total_materials_stored: 0,
      };

      // Count by type
      locations.forEach((loc) => {
        if (summary.by_type[loc.location_type] !== undefined) {
          summary.by_type[loc.location_type]++;
        }
        if (loc.has_positions) {
          summary.with_positions++;
        }
      });

      // Count total materials with stock
      const materialsWithStock = await this.materialModel
        .countDocuments({
          current_stock: { $exists: true, $ne: [] },
        })
        .exec();

      summary.total_materials_stored = materialsWithStock;

      return {
        status: 'success',
        message: 'Location summary retrieved successfully',
        data: [summary],
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Failed to get summary: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Position Methods (Basic) =====

  async getPositionsInLocation(
    locationCode: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const location = await this.validateLocationExists(locationCode);

      if (!location.has_positions) {
        return {
          status: 'success',
          message: `Location ${locationCode} does not have positions`,
          data: [],
        };
      }

      const positions = await this.locationModel.db
        .collection('material_position')
        .find({ location_id: location._id })
        .sort({ position_code: 1 })
        .toArray();

      return {
        status: 'success',
        message: `Found ${positions.length} positions in location ${locationCode}`,
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

  async getAvailablePositions(
    locationCode: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const location = await this.validateLocationExists(locationCode);

      if (!location.has_positions) {
        return {
          status: 'success',
          message: `Location ${locationCode} does not have positions`,
          data: [],
        };
      }

      const availablePositions = await this.locationModel.db
        .collection('material_position')
        .find({
          location_id: location._id,
          is_occupied: false,
        })
        .sort({ position_code: 1 })
        .toArray();

      return {
        status: 'success',
        message: `Found ${availablePositions.length} available positions`,
        data: availablePositions,
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
}
