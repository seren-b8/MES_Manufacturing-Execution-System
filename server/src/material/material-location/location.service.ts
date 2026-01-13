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
}
