import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { LocationService } from './material-location/location.service';
import { ResponseFormat } from 'src/shared/interface';
import {
  MaterialPosition,
  MaterialPositionDocument,
} from 'src/schema/material-position.schema';
import { Material, MaterialDocument } from 'src/schema/material.schema';
import { MaterialStockDto } from './dto/material-stock-response.dto';
import { QueryMaterialDto } from './dto/query-material.dto';

@Injectable()
export class MaterialService {
  constructor(
    @InjectModel(Material.name)
    private readonly materialModel: Model<MaterialDocument>,
    @InjectModel(MaterialPosition.name)
    private readonly positionModel: Model<MaterialPositionDocument>,
    private readonly locationService: LocationService,
  ) {}

  async findAll(query: QueryMaterialDto): Promise<ResponseFormat<Material>> {
    try {
      const {
        material_number,
        material_description,
        location_code,
        has_stock,
        page = 1,
        limit = 50,
        sort_by = 'material_number',
        sort_order = 'asc',
      } = query;

      // Build filter
      const filter: any = {};

      if (material_number) {
        filter.material_number = { $regex: material_number, $options: 'i' };
      }

      if (material_description) {
        filter.material_description = {
          $regex: material_description,
          $options: 'i',
        };
      }

      if (location_code) {
        filter['current_stock.location_id'] = location_code;
      }

      if (has_stock !== undefined) {
        if (has_stock) {
          filter['current_stock'] = { $exists: true, $ne: [] };
        } else {
          filter.$or = [
            { current_stock: { $exists: false } },
            { current_stock: { $eq: [] } },
          ];
        }
      }

      // Sort
      const sortOrder = sort_order === 'asc' ? 1 : -1;
      const sortObj: any = { [sort_by]: sortOrder };

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const materials = await this.materialModel
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('current_stock.location_id', 'location_name location_code')
        .populate('current_stock.position_id', 'position_code')
        .exec();

      const total = await this.materialModel.countDocuments(filter);

      return {
        status: 'success',
        message: `Found ${materials.length} materials (Total: ${total})`,
        data: materials,
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch materials: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findOne(materialId: string): Promise<ResponseFormat<Material>> {
    try {
      if (!Types.ObjectId.isValid(materialId)) {
        throw new BadRequestException('Invalid material ID format');
      }

      const material = await this.materialModel
        .findById(materialId)
        .populate(
          'current_stock.location_id',
          'location_name location_code location_type',
        )
        .populate('current_stock.position_id', 'position_code shelf_code')
        .exec();

      if (!material) {
        throw new NotFoundException(`Material with ID ${materialId} not found`);
      }

      return {
        status: 'success',
        message: 'Material retrieved successfully',
        data: [material],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch material: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findByMaterialNumber(
    materialNumber: string,
  ): Promise<ResponseFormat<Material>> {
    try {
      const material = await this.materialModel
        .findOne({ material_number: materialNumber })
        .populate(
          'current_stock.location_id',
          'location_name location_code location_type',
        )
        .populate('current_stock.position_id', 'position_code')
        .exec();

      if (!material) {
        throw new NotFoundException(`Material ${materialNumber} not found`);
      }

      return {
        status: 'success',
        message: 'Material retrieved successfully',
        data: [material],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch material: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async searchMaterials(
    searchQuery: string,
  ): Promise<ResponseFormat<Material>> {
    try {
      const materials = await this.materialModel
        .find({
          $or: [
            { material_number: { $regex: searchQuery, $options: 'i' } },
            { material_description: { $regex: searchQuery, $options: 'i' } },
          ],
        })
        .limit(20)
        .populate('current_stock.location_id', 'location_name location_code')
        .exec();

      return {
        status: 'success',
        message: `Found ${materials.length} materials matching "${searchQuery}"`,
        data: materials,
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Search failed: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Stock Methods =====

  async getStockByLocation(
    materialNumber: string,
  ): Promise<ResponseFormat<MaterialStockDto>> {
    try {
      const material = await this.materialModel
        .findOne({ material_number: materialNumber })
        .populate('current_stock.location_id', 'location_name location_code')
        .populate('current_stock.position_id', 'position_code')
        .exec();

      if (!material) {
        throw new NotFoundException(`Material ${materialNumber} not found`);
      }

      const stockDetails: MaterialStockDto[] = material.current_stock.map(
        (stock: any) => ({
          location_code: stock.location_id?.location_code || 'Unknown',
          location_name: stock.location_id?.location_name || 'Unknown',
          position_code: stock.position_id?.position_code,
          stock_quantity: stock.stock_quantity,
          lot_number: stock.lot_number,
        }),
      );

      return {
        status: 'success',
        message: 'Stock breakdown retrieved successfully',
        data: stockDetails,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to get stock: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async getTotalStock(materialNumber: string): Promise<number> {
    try {
      const material = await this.materialModel
        .findOne({ material_number: materialNumber })
        .exec();

      if (!material) {
        throw new NotFoundException(`Material ${materialNumber} not found`);
      }

      return this.calculateTotalStock(material);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        `Failed to calculate total stock: ${(error as Error).message}`,
      );
    }
  }

  async checkStockAvailability(
    materialNumber: string,
    locationCode: string,
    requiredQuantity: number,
  ): Promise<boolean> {
    try {
      const material = await this.materialModel
        .findOne({ material_number: materialNumber })
        .populate('current_stock.location_id', 'location_code')
        .exec();

      if (!material) {
        throw new NotFoundException(`Material ${materialNumber} not found`);
      }

      const stockAtLocation = material.current_stock.find(
        (stock: any) => stock.location_id?.location_code === locationCode,
      );

      if (!stockAtLocation) {
        return false;
      }

      return stockAtLocation.stock_quantity >= requiredQuantity;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        `Failed to check stock: ${(error as Error).message}`,
      );
    }
  }

  // ===== Stock Update Methods (Internal) =====

  async updateStock(
    materialNumber: string,
    locationCode: string,
    quantityChange: number,
    positionCode?: string,
    lotNumber?: string,
  ): Promise<void> {
    try {
      if (quantityChange > 0) {
        await this.addStockToLocation(
          materialNumber,
          locationCode,
          quantityChange,
          positionCode,
          lotNumber,
        );
      } else if (quantityChange < 0) {
        await this.removeStockFromLocation(
          materialNumber,
          locationCode,
          Math.abs(quantityChange),
          positionCode,
          lotNumber,
        );
      }
    } catch (error) {
      throw new BadRequestException(
        `Stock update failed: ${(error as Error).message}`,
      );
    }
  }

  async addStockToLocation(
    materialNumber: string,
    locationCode: string,
    quantity: number,
    positionCode?: string,
    lotNumber?: string,
  ): Promise<void> {
    try {
      // Validate material exists
      const material = await this.validateMaterialExists(materialNumber);

      // Find location by code
      const {
        MaterialLocation,
      } = require('../schema/material-location.schema');
      const location = await this.materialModel.db
        .collection('material_location')
        .findOne({ location_code: locationCode });

      if (!location) {
        throw new NotFoundException(`Location ${locationCode} not found`);
      }

      const locationId = location._id;

      // Find position if provided
      let positionId = null;
      if (positionCode) {
        const position = await this.materialModel.db
          .collection('material_position')
          .findOne({ position_code: positionCode, location_id: locationId });

        if (position) {
          positionId = position._id;
        }
      }

      // Check if stock already exists for this location/position/lot
      const existingStockIndex = material.current_stock.findIndex(
        (stock: any) => {
          const locationMatch =
            stock.location_id.toString() === locationId.toString();
          const positionMatch = positionId
            ? stock.position_id?.toString() === positionId.toString()
            : !stock.position_id;
          const lotMatch = lotNumber
            ? stock.lot_number === lotNumber
            : !stock.lot_number;

          return locationMatch && positionMatch && lotMatch;
        },
      );

      if (existingStockIndex !== -1) {
        // Update existing stock
        material.current_stock[existingStockIndex].stock_quantity += quantity;
      } else {
        // Add new stock entry
        material.current_stock.push({
          location_id: locationId,
          position_id: positionId,
          stock_quantity: quantity,
          lot_number: lotNumber,
        } as any);
      }

      await material.save();
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        `Failed to add stock: ${(error as Error).message}`,
      );
    }
  }

  async removeStockFromLocation(
    materialNumber: string,
    locationCode: string,
    quantity: number,
    positionCode?: string,
    lotNumber?: string,
  ): Promise<void> {
    try {
      // Validate material exists
      const material = await this.validateMaterialExists(materialNumber);

      // Find location
      const location = await this.materialModel.db
        .collection('material_location')
        .findOne({ location_code: locationCode });

      if (!location) {
        throw new NotFoundException(`Location ${locationCode} not found`);
      }

      const locationId = location._id;

      // Find position if provided
      let positionId = null;
      if (positionCode) {
        const position = await this.materialModel.db
          .collection('material_position')
          .findOne({ position_code: positionCode, location_id: locationId });

        if (position) {
          positionId = position._id;
        }
      }

      // Find matching stock entry
      const stockIndex = material.current_stock.findIndex((stock: any) => {
        const locationMatch =
          stock.location_id.toString() === locationId.toString();
        const positionMatch = positionId
          ? stock.position_id?.toString() === positionId.toString()
          : !stock.position_id;
        const lotMatch = lotNumber
          ? stock.lot_number === lotNumber
          : !stock.lot_number;

        return locationMatch && positionMatch && lotMatch;
      });

      if (stockIndex === -1) {
        throw new NotFoundException(
          `No stock found for material ${materialNumber} at location ${locationCode}`,
        );
      }

      const currentStock = material.current_stock[stockIndex].stock_quantity;

      if (currentStock < quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${currentStock}, Required: ${quantity}`,
        );
      }

      // Update stock
      material.current_stock[stockIndex].stock_quantity -= quantity;

      // Remove entry if stock becomes 0
      if (material.current_stock[stockIndex].stock_quantity === 0) {
        material.current_stock.splice(stockIndex, 1);
      }

      await material.save();
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to remove stock: ${(error as Error).message}`,
      );
    }
  }

  // ===== Helper Methods =====

  async validateMaterialExists(
    materialNumber: string,
  ): Promise<MaterialDocument> {
    const material = await this.materialModel
      .findOne({ material_number: materialNumber })
      .exec();

    if (!material) {
      throw new NotFoundException(`Material ${materialNumber} not found`);
    }

    return material;
  }

  private calculateTotalStock(material: Material): number {
    if (!material.current_stock || material.current_stock.length === 0) {
      return 0;
    }

    return material.current_stock.reduce(
      (total, stock: any) => total + (stock.stock_quantity || 0),
      0,
    );
  }
}
