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
import {
  QueryMaterialDto,
  QueryMaterialInventoryDto,
} from './dto/query-material.dto';
import {
  MaterialTransaction,
  MaterialTransactionDocument,
} from 'src/schema/material-transaction.schema';
import { MaterialLocation } from 'src/schema/material-location.schema';
import { MaterialInventoryRow } from './dto/material-inventory-row.dto';

@Injectable()
export class MaterialService {
  constructor(
    @InjectModel(Material.name)
    private readonly materialModel: Model<MaterialDocument>,
    @InjectModel(MaterialPosition.name)
    private readonly positionModel: Model<MaterialPositionDocument>,
    @InjectModel(MaterialTransaction.name)
    private transactionModel: Model<MaterialTransactionDocument>,
    @InjectModel(MaterialLocation.name)
    private readonly locationModel: Model<MaterialLocation>,
    private readonly locationService: LocationService,
  ) {}

  async findAll(query: QueryMaterialDto): Promise<ResponseFormat<Material>> {
    try {
      const {
        material_number,
        material_description,
        unit_of_measurement,
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
      if (unit_of_measurement) {
        filter.unit_of_measurement = {
          $regex: unit_of_measurement,
          $options: 'i',
        };
      }

      // Sort
      const sortOrderNum = sort_order === 'asc' ? 1 : -1;
      const sortObj: any = { [sort_by]: sortOrderNum };

      // Execute query - ไม่มี pagination
      const materials = await this.materialModel
        .find(filter)
        .select(
          'material_number material_description unit_of_measurement createdAt updatedAt',
        )
        .sort(sortObj)
        .lean()
        .exec();

      return {
        status: 'success',
        message: `Found ${materials.length} materials`,
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

  async findInventoryTable(
    query: QueryMaterialInventoryDto,
  ): Promise<ResponseFormat<MaterialInventoryRow>> {
    try {
      const {
        material_number,
        material_description,
        location_code,
        lot_number,
        sort_by = 'material_number',
        sort_order = 'asc',
      } = query;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 50;

      // Build match stage
      const matchStage: any = {};
      if (material_number) {
        matchStage.material_number = { $regex: material_number, $options: 'i' };
      }
      if (material_description) {
        matchStage.material_description = {
          $regex: material_description,
          $options: 'i',
        };
      }

      // Aggregation pipeline
      const pipeline: any[] = [
        { $match: matchStage },
        {
          $unwind: {
            path: '$current_stock',
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $lookup: {
            from: 'material_location',
            localField: 'current_stock.location_id',
            foreignField: '_id',
            as: 'location',
          },
        },
        {
          $lookup: {
            from: 'material_position',
            localField: 'current_stock.position_id',
            foreignField: '_id',
            as: 'position',
          },
        },
        { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$position', preserveNullAndEmptyArrays: true } },
      ];

      // Filter after unwind
      const postUnwindMatch: any = {};
      if (location_code) {
        postUnwindMatch['location.location_code'] = location_code;
      }
      if (lot_number) {
        postUnwindMatch['current_stock.lot_number'] = {
          $regex: lot_number,
          $options: 'i',
        };
      }
      if (Object.keys(postUnwindMatch).length > 0) {
        pipeline.push({ $match: postUnwindMatch });
      }

      // Project to flatten structure
      pipeline.push({
        $project: {
          material_number: 1,
          material_description: 1,
          unit_of_measurement: 1,
          location_code: '$location.location_code',
          location_name: '$location.location_name',
          position_code: '$position.position_code',
          lot_number: '$current_stock.lot_number',
          stock_quantity: '$current_stock.stock_quantity',
        },
      });

      // Sort
      const sortDirection = sort_order === 'asc' ? 1 : -1;
      pipeline.push({ $sort: { [sort_by]: sortDirection } });

      // Count total
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await this.materialModel.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      // Pagination
      const skip = (page - 1) * limit;
      pipeline.push({ $skip: skip }, { $limit: limit });

      // Execute
      const results = await this.materialModel.aggregate(pipeline);

      return {
        status: 'success',
        message: `Found ${results.length} inventory records`,
        data: results,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch inventory: ${(error as Error).message}`,
        data: [],
        pagination: [],
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
    positionCode?: string,
    lotNumber?: string,
  ): Promise<boolean> {
    try {
      // 1. Validate inputs
      if (requiredQuantity <= 0) {
        throw new BadRequestException(
          'Required quantity must be greater than 0',
        );
      }

      // 2. Fetch material with populated location
      const material = await this.materialModel
        .findOne({ material_number: materialNumber })
        .populate('current_stock.location_id', 'location_code location_name')
        .populate('current_stock.position_id', 'position_code')
        .exec();

      if (!material) {
        throw new NotFoundException(`Material ${materialNumber} not found`);
      }

      // 3. Filter stock entries by location
      const stocksAtLocation = material.current_stock.filter(
        (stock: any) => stock.location_id?.location_code === locationCode,
      );

      if (stocksAtLocation.length === 0) {
        return false;
      }

      // 4. Further filter by position if specified
      let relevantStocks = stocksAtLocation;

      if (positionCode) {
        relevantStocks = stocksAtLocation.filter(
          (stock: any) => stock.position_id?.position_code === positionCode,
        );

        if (relevantStocks.length === 0) {
          return false;
        }
      }

      // 5. Further filter by lot number if specified
      if (lotNumber) {
        relevantStocks = relevantStocks.filter(
          (stock: any) => stock.lot_number === lotNumber,
        );

        if (relevantStocks.length === 0) {
          return false;
        }
      }

      // 6. Calculate total available quantity
      const totalAvailable = relevantStocks.reduce(
        (sum: number, stock: any) => sum + (stock.stock_quantity || 0),
        0,
      );

      return totalAvailable >= requiredQuantity;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to check stock availability: ${(error as Error).message}`,
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
  }

  async addStockToLocation(
    materialNumber: string,
    locationCode: string,
    quantity: number,
    positionCode?: string,
    lotNumber?: string,
  ): Promise<void> {
    // Validate material exists
    const material = await this.validateMaterialExists(materialNumber);

    // Find location by code
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
  }

  async removeStockFromLocation(
    materialNumber: string,
    locationCode: string,
    quantity: number,
    positionCode?: string,
    lotNumber?: string,
  ): Promise<void> {
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
  }

  // ===== Helper Methods =====

  async validateMaterialExists(
    materialNumber: string,
  ): Promise<MaterialDocument> {
    const query = this.materialModel.findOne({
      material_number: materialNumber,
    });

    const material = await query.exec();

    if (!material) {
      throw new NotFoundException(`Material ${materialNumber} not found`);
    }

    return material;
  }

  async clearAllStock(): Promise<ResponseFormat<any>> {
    // 1. Clear all current_stock
    const materialResult = await this.materialModel
      .updateMany({}, { $set: { current_stock: [] } })
      .exec();

    // 2. Delete all transactions
    const transactionResult = await this.transactionModel.deleteMany({}).exec();

    // 3. Reset all positions to not occupied
    const positionResult = await this.positionModel
      .updateMany({}, { $set: { is_occupied: false } })
      .exec();

    return {
      status: 'success',
      message: 'All stock cleared successfully',
      data: [
        {
          materials_updated: materialResult.modifiedCount,
          transactions_deleted: transactionResult.deletedCount,
          positions_reset: positionResult.modifiedCount,
        },
      ],
    };
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
