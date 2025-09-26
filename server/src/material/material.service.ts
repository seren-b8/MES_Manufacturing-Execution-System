import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { StockOperationDto, TransferStockDto } from './dto/stock-operation.dto';
import { LocationService } from './material-location/location.service';
import { ResponseFormat } from 'src/shared/interface';
import { StockQueryDto } from './dto/stock-query.dto';
import {
  MaterialPosition,
  MaterialPositionDocument,
} from 'src/schema/material-position.schema';
import { PositionStockDto } from './dto/position-stock.dto';
import { Material, MaterialDocument } from 'src/schema/material.schema';

@Injectable()
export class MaterialService {
  constructor(
    @InjectModel(Material.name)
    private readonly materialModel: Model<MaterialDocument>,
    @InjectModel(MaterialPosition.name)
    private readonly positionModel: Model<MaterialPositionDocument>,
    private readonly locationService: LocationService,
  ) {}

  async create(dto: CreateMaterialDto): Promise<ResponseFormat<Material>> {
    try {
      // Check if material_number already exists
      const existingMaterial = await this.materialModel.findOne({
        material_number: dto.material_number,
      });

      if (existingMaterial) {
        throw new ConflictException({
          status: 'error',
          message: 'Material number already exists',
          data: [],
        });
      }

      // Validate locations and positions if initial_stock is provided
      if (dto.initial_stock && dto.initial_stock.length > 0) {
        for (const stock of dto.initial_stock) {
          const locationExists =
            await this.locationService.validateLocationExists(
              stock.location_id,
            );
          if (!locationExists) {
            throw new BadRequestException({
              status: 'error',
              message: `Location ${stock.location_id} does not exist`,
              data: [],
            });
          }

          // If position_code is provided, validate position support
          if (stock.position_code) {
            const locationSupportsPositions =
              await this.locationService.validateLocationSupportsPositions(
                stock.location_id,
              );
            if (!locationSupportsPositions) {
              throw new BadRequestException({
                status: 'error',
                message: `Location ${stock.location_id} does not support positions`,
                data: [],
              });
            }
          }
        }
      }

      // Prepare current_stock array
      const currentStock =
        dto.initial_stock?.map((stock) => ({
          location_id: new Types.ObjectId(stock.location_id),
          position_id: null, // Will be set when position is created
          stock_quantity: stock.stock_quantity,
          lot_number: stock.lot_number || null,
        })) || [];

      const materialData = {
        material_number: dto.material_number,
        material_description: dto.material_description,
        unit_of_measurement: dto.unit_of_measurement,
        standard_cost: dto.standard_cost,
        material_type: dto.material_type,
        current_stock: currentStock,
      };

      const newMaterial = new this.materialModel(materialData);
      const savedMaterial = await newMaterial.save();

      // Handle position creation for initial stock
      if (dto.initial_stock) {
        for (const stock of dto.initial_stock) {
          if (stock.position_code) {
            await this.createOrUpdatePositionStock({
              material_id: savedMaterial._id.toString(),
              location_id: stock.location_id,
              position_code: stock.position_code,
              quantity: stock.stock_quantity,
              lot_number: stock.lot_number,
            });
          }
        }
      }

      return {
        status: 'success',
        message: 'Material created successfully',
        data: [savedMaterial],
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
        message: (error as Error).message || 'Failed to create material',
        data: [],
      });
    }
  }

  async getMaterialMovementSummary(
    materialId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ResponseFormat<any>> {
    try {
      // This will be implemented when transaction data is available
      // For now, return current stock summary
      const material = await this.materialModel
        .findById(materialId)
        .populate(
          'current_stock.location_id',
          'location_name location_code location_type',
        )
        .exec();

      if (!material) {
        throw new NotFoundException({
          status: 'error',
          message: 'Material not found',
          data: [],
        });
      }

      const summary = {
        material_id: material._id,
        material_number: material.material_number,
        material_description: material.material_description,
        current_total_stock: material.current_stock.reduce(
          (sum, stock) => sum + stock.stock_quantity,
          0,
        ),
        stock_locations: material.current_stock.length,
        stock_by_location: material.current_stock.map((stock) => ({
          location: stock.location_id,
          stock_quantity: stock.stock_quantity,
          lot_number: stock.lot_number,
        })),
      };

      return {
        status: 'success',
        message: 'Material movement summary retrieved successfully',
        data: [summary],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve material movement summary',
        data: [],
      });
    }
  }

  async findAll(): Promise<ResponseFormat<Material>> {
    try {
      const materials = await this.materialModel
        .find()
        .populate(
          'current_stock.location_id',
          'location_name location_code location_type',
        )
        .sort({ material_number: 1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${materials.length} materials`,
        data: materials,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve materials',
        data: [],
      });
    }
  }

  async findById(id: string): Promise<ResponseFormat<Material>> {
    try {
      const material = await this.materialModel
        .findById(id)
        .populate(
          'current_stock.location_id',
          'location_name location_code location_type',
        )
        .exec();

      if (!material) {
        throw new NotFoundException({
          status: 'error',
          message: 'Material not found',
          data: [],
        });
      }

      return {
        status: 'success',
        message: 'Material retrieved successfully',
        data: [material],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve material',
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
        .exec();

      if (!material) {
        throw new NotFoundException({
          status: 'error',
          message: 'Material not found',
          data: [],
        });
      }

      return {
        status: 'success',
        message: 'Material retrieved successfully',
        data: [material],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve material',
        data: [],
      });
    }
  }

  async update(
    id: string,
    dto: UpdateMaterialDto,
  ): Promise<ResponseFormat<Material>> {
    try {
      const updatedMaterial = await this.materialModel
        .findByIdAndUpdate(id, dto, { new: true })
        .populate(
          'current_stock.location_id',
          'location_name location_code location_type',
        )
        .exec();

      if (!updatedMaterial) {
        throw new NotFoundException({
          status: 'error',
          message: 'Material not found',
          data: [],
        });
      }

      return {
        status: 'success',
        message: 'Material updated successfully',
        data: [updatedMaterial],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new ConflictException({
        status: 'error',
        message: (error as Error).message || 'Failed to update material',
        data: [],
      });
    }
  }

  async delete(id: string): Promise<ResponseFormat<Material>> {
    try {
      // Check if material has stock before deleting
      const material = await this.materialModel.findById(id);
      if (
        material &&
        material.current_stock.some((stock) => stock.stock_quantity > 0)
      ) {
        throw new ConflictException({
          status: 'error',
          message: 'Cannot delete material with existing stock',
          data: [],
        });
      }

      // Check if material exists in any positions
      const positionsWithMaterial = await this.positionModel.find({
        'current_materials.material_id': new Types.ObjectId(id),
      });

      if (positionsWithMaterial.length > 0) {
        throw new ConflictException({
          status: 'error',
          message: 'Cannot delete material that exists in positions',
          data: [],
        });
      }

      const deletedMaterial = await this.materialModel
        .findByIdAndDelete(id)
        .exec();

      if (!deletedMaterial) {
        throw new NotFoundException({
          status: 'error',
          message: 'Material not found',
          data: [],
        });
      }

      return {
        status: 'success',
        message: 'Material deleted successfully',
        data: [deletedMaterial],
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
        message: 'Failed to delete material',
        data: [],
      });
    }
  }

  // Enhanced stock methods with position support
  async getStock(
    materialId: string,
    query: StockQueryDto = {},
  ): Promise<ResponseFormat<any>> {
    try {
      const material = await this.materialModel
        .findById(materialId)
        .populate(
          'current_stock.location_id',
          'location_name location_code location_type has_positions',
        )
        .exec();

      if (!material) {
        throw new NotFoundException({
          status: 'error',
          message: 'Material not found',
          data: [],
        });
      }

      let stockData = material.current_stock;

      // Filter by location if specified
      if (query.location_id) {
        stockData = stockData.filter(
          (stock) => stock.location_id._id.toString() === query.location_id,
        );
      }

      // Filter by lot if specified
      if (query.lot_number) {
        stockData = stockData.filter(
          (stock) => stock.lot_number === query.lot_number,
        );
      }

      // Include position details if requested
      if (query.include_positions) {
        const enrichedStockData = [];

        for (const stock of stockData) {
          const locationId = stock.location_id._id
            ? stock.location_id._id.toString()
            : stock.location_id.toString();
          const location = stock.location_id;

          if (
            typeof location === 'object' &&
            'has_positions' in location &&
            location.has_positions
          ) {
            // Get positions for this location and material
            const positions = await this.positionModel
              .find({
                location_id: new Types.ObjectId(locationId),
                'current_materials.material_id': new Types.ObjectId(materialId),
              })
              .exec();

            const positionDetails = positions
              .map((pos) => {
                const materialInPosition = pos.current_materials.find(
                  (mat) =>
                    mat.material_id.toString() === materialId &&
                    (!query.lot_number || mat.lot_number === query.lot_number),
                );

                return {
                  position_code: pos.position_code,
                  shelf_code: pos.shelf_code,
                  row: pos.row,
                  column: pos.column,
                  quantity: materialInPosition?.quantity || 0,
                  lot_number: materialInPosition?.lot_number,
                  max_capacity: pos.max_capacity,
                  is_occupied: pos.is_occupied,
                };
              })
              .filter((pos) => pos.quantity > 0);

            enrichedStockData.push({
              ...stock,
              positions: positionDetails,
              total_in_positions: positionDetails.reduce(
                (sum, pos) => sum + pos.quantity,
                0,
              ),
            });
          } else {
            enrichedStockData.push({
              ...stock,
              positions: [],
              total_in_positions: 0,
            });
          }
        }

        stockData = enrichedStockData;
      }

      // Group by lot if requested
      if (query.group_by_lot) {
        const groupedData = {};
        stockData.forEach((stock) => {
          const lot = stock.lot_number || 'NO_LOT';
          if (!groupedData[lot]) {
            groupedData[lot] = {
              lot_number: stock.lot_number,
              total_quantity: 0,
              locations: [],
            };
          }
          groupedData[lot].total_quantity += stock.stock_quantity;
          groupedData[lot].locations.push(stock);
        });

        stockData = Object.values(groupedData);
      }

      return {
        status: 'success',
        message: 'Stock retrieved successfully',
        data: Array.isArray(stockData) ? stockData : [stockData],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve stock',
        data: [],
      });
    }
  }

  async getStockByPosition(
    materialId: string,
    locationId: string,
    positionCode: string,
    lotNumber?: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const position = await this.positionModel
        .findOne({
          location_id: new Types.ObjectId(locationId),
          position_code: positionCode,
        })
        .populate('location_id', 'location_name location_code location_type')
        .exec();

      if (!position) {
        throw new NotFoundException({
          status: 'error',
          message: 'Position not found',
          data: [],
        });
      }

      const materialInPosition = position.current_materials.find((mat) => {
        const materialMatch = mat.material_id.toString() === materialId;
        const lotMatch = !lotNumber || mat.lot_number === lotNumber;
        return materialMatch && lotMatch;
      });

      const stockData = {
        position_code: position.position_code,
        location_id: position.location_id,
        material_id: materialId,
        quantity: materialInPosition?.quantity || 0,
        lot_number: materialInPosition?.lot_number,
        max_capacity: position.max_capacity,
        available_capacity: position.max_capacity
          ? position.max_capacity -
            position.current_materials.reduce(
              (sum, mat) => sum + mat.quantity,
              0,
            )
          : null,
      };

      return {
        status: 'success',
        message: 'Position stock retrieved successfully',
        data: [stockData],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve position stock',
        data: [],
      });
    }
  }

  async findMaterialsByLocation(
    locationId: string,
    includePositions: boolean = false,
  ): Promise<ResponseFormat<any>> {
    try {
      // Get materials that have stock in this location
      const materials = await this.materialModel
        .find({
          'current_stock.location_id': new Types.ObjectId(locationId),
          'current_stock.stock_quantity': { $gt: 0 },
        })
        .populate(
          'current_stock.location_id',
          'location_name location_code location_type',
        )
        .exec();

      const result = [];

      for (const material of materials) {
        const locationStock = material.current_stock.find(
          (stock) => stock.location_id._id.toString() === locationId,
        );

        let materialData = {
          material_id: material._id,
          material_number: material.material_number,
          material_description: material.material_description,
          stock_quantity: locationStock?.stock_quantity || 0,
          lot_number: locationStock?.lot_number,
          positions: [],
        };

        // Include position details if requested
        if (includePositions) {
          const positions = await this.positionModel
            .find({
              location_id: new Types.ObjectId(locationId),
              'current_materials.material_id': material._id,
            })
            .exec();

          materialData.positions = positions
            .map((pos) => {
              const materialInPosition = pos.current_materials.find(
                (mat) => mat.material_id.toString() === material._id.toString(),
              );

              return {
                position_code: pos.position_code,
                quantity: materialInPosition?.quantity || 0,
                lot_number: materialInPosition?.lot_number,
              };
            })
            .filter((pos) => pos.quantity > 0);
        }

        result.push(materialData);
      }

      return {
        status: 'success',
        message: `Found ${result.length} materials in location`,
        data: result,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve materials by location',
        data: [],
      });
    }
  }

  // Position-specific methods
  async createOrUpdatePositionStock(dto: PositionStockDto): Promise<void> {
    const position = await this.positionModel.findOne({
      location_id: new Types.ObjectId(dto.location_id),
      position_code: dto.position_code,
    });

    if (!position) {
      // Create new position
      const newPosition = new this.positionModel({
        location_id: new Types.ObjectId(dto.location_id),
        position_code: dto.position_code,
        current_materials: [
          {
            material_id: new Types.ObjectId(dto.material_id),
            quantity: dto.quantity,
            lot_number: dto.lot_number,
          },
        ],
      });
      await newPosition.save();
    } else {
      // Update existing position
      const materialIndex = position.current_materials.findIndex((mat) => {
        const materialMatch = mat.material_id.toString() === dto.material_id;
        const lotMatch = !dto.lot_number || mat.lot_number === dto.lot_number;
        return materialMatch && lotMatch;
      });

      if (materialIndex >= 0) {
        position.current_materials[materialIndex].quantity = dto.quantity;
      } else {
        position.current_materials.push({
          material_id: new Types.ObjectId(dto.material_id),
          quantity: dto.quantity,
          lot_number: dto.lot_number,
        });
      }

      await position.save();
    }
  }

  // Keep existing methods with minimal changes
  async initializeStock(
    dto: StockOperationDto,
  ): Promise<ResponseFormat<Material>> {
    try {
      // Validate location exists
      const locationExists = await this.locationService.validateLocationExists(
        dto.location_id,
      );
      if (!locationExists) {
        throw new BadRequestException({
          status: 'error',
          message: 'Location does not exist',
          data: [],
        });
      }

      const material = await this.materialModel.findById(dto.material_id);
      if (!material) {
        throw new NotFoundException({
          status: 'error',
          message: 'Material not found',
          data: [],
        });
      }

      // Check if stock already exists for this location
      const existingStockIndex = material.current_stock.findIndex(
        (stock) => stock.location_id.toString() === dto.location_id,
      );

      if (existingStockIndex >= 0) {
        throw new ConflictException({
          status: 'error',
          message:
            'Stock already exists for this location. Use updateStock instead.',
          data: [],
        });
      }

      // Add new stock entry
      material.current_stock.push({
        location_id: new Types.ObjectId(dto.location_id),
        position_id: null,
        stock_quantity: dto.quantity,
        lot_number: null,
      });

      const savedMaterial = await material.save();

      return {
        status: 'success',
        message: 'Stock initialized successfully',
        data: [savedMaterial],
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ConflictException({
        status: 'error',
        message: 'Failed to initialize stock',
        data: [],
      });
    }
  }

  async updateStock(
    materialId: string,
    locationId: string,
    quantity: number,
    operation: 'add' | 'subtract' | 'set' = 'set',
  ): Promise<ResponseFormat<Material>> {
    try {
      const material = await this.materialModel.findById(materialId);
      if (!material) {
        throw new NotFoundException({
          status: 'error',
          message: 'Material not found',
          data: [],
        });
      }

      const stockIndex = material.current_stock.findIndex(
        (stock) => stock.location_id.toString() === locationId,
      );

      if (stockIndex === -1) {
        throw new NotFoundException({
          status: 'error',
          message: 'Stock not found for this location',
          data: [],
        });
      }

      let newQuantity: number;
      switch (operation) {
        case 'add':
          newQuantity =
            material.current_stock[stockIndex].stock_quantity + quantity;
          break;
        case 'subtract':
          newQuantity =
            material.current_stock[stockIndex].stock_quantity - quantity;
          if (newQuantity < 0) {
            throw new BadRequestException({
              status: 'error',
              message: 'Insufficient stock quantity',
              data: [],
            });
          }
          break;
        case 'set':
        default:
          newQuantity = quantity;
          break;
      }

      material.current_stock[stockIndex].stock_quantity = newQuantity;
      const savedMaterial = await material.save();

      return {
        status: 'success',
        message: 'Stock updated successfully',
        data: [savedMaterial],
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
        message: 'Failed to update stock',
        data: [],
      });
    }
  }

  async transferStock(
    dto: TransferStockDto,
  ): Promise<ResponseFormat<Material>> {
    try {
      // Validate locations exist
      const fromLocationExists =
        await this.locationService.validateLocationExists(dto.from_location_id);
      const toLocationExists =
        await this.locationService.validateLocationExists(dto.to_location_id);

      if (!fromLocationExists || !toLocationExists) {
        throw new BadRequestException({
          status: 'error',
          message: 'One or both locations do not exist',
          data: [],
        });
      }

      const material = await this.materialModel.findById(dto.material_id);
      if (!material) {
        throw new NotFoundException({
          status: 'error',
          message: 'Material not found',
          data: [],
        });
      }

      // Find source and destination stock entries
      const fromStockIndex = material.current_stock.findIndex(
        (stock) => stock.location_id.toString() === dto.from_location_id,
      );

      if (fromStockIndex === -1) {
        throw new NotFoundException({
          status: 'error',
          message: 'Source stock not found',
          data: [],
        });
      }

      // Check sufficient stock
      if (
        material.current_stock[fromStockIndex].stock_quantity < dto.quantity
      ) {
        throw new BadRequestException({
          status: 'error',
          message: 'Insufficient stock quantity',
          data: [],
        });
      }

      // Subtract from source
      material.current_stock[fromStockIndex].stock_quantity -= dto.quantity;

      // Add to destination (create if doesn't exist)
      const toStockIndex = material.current_stock.findIndex(
        (stock) => stock.location_id.toString() === dto.to_location_id,
      );

      if (toStockIndex === -1) {
        // Create new stock entry for destination
        material.current_stock.push({
          location_id: new Types.ObjectId(dto.to_location_id),
          position_id: null,
          stock_quantity: dto.quantity,
          lot_number: null,
        });
      } else {
        // Add to existing stock
        material.current_stock[toStockIndex].stock_quantity += dto.quantity;
      }

      const savedMaterial = await material.save();

      return {
        status: 'success',
        message: 'Stock transferred successfully',
        data: [savedMaterial],
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
        message: 'Failed to transfer stock',
        data: [],
      });
    }
  }

  // Helper methods
  async validateMaterialExists(materialId: string): Promise<boolean> {
    const material = await this.materialModel.findById(materialId);
    return !!material;
  }

  async getAvailableStock(
    materialId: string,
    locationId: string,
  ): Promise<number> {
    const material = await this.materialModel.findById(materialId);
    if (!material) return 0;

    const stock = material.current_stock.find(
      (s) => s.location_id.toString() === locationId,
    );

    return stock?.stock_quantity || 0;
  }

  // Statistics and reporting methods
  async getMaterialStats(): Promise<ResponseFormat<any>> {
    try {
      const totalMaterials = await this.materialModel.countDocuments();
      const materialsWithStock = await this.materialModel.countDocuments({
        'current_stock.stock_quantity': { $gt: 0 },
      });

      // Aggregate statistics
      const stats = await this.materialModel.aggregate([
        { $unwind: '$current_stock' },
        { $match: { 'current_stock.stock_quantity': { $gt: 0 } } },
        {
          $group: {
            _id: null,
            total_stock_value: { $sum: '$current_stock.stock_quantity' },
            total_locations: { $addToSet: '$current_stock.location_id' },
            materials_by_type: { $addToSet: '$material_type' },
          },
        },
      ]);

      const result = {
        total_materials: totalMaterials,
        materials_with_stock: materialsWithStock,
        materials_without_stock: totalMaterials - materialsWithStock,
        total_stock_value: stats[0]?.total_stock_value || 0,
        unique_locations: stats[0]?.total_locations?.length || 0,
        material_types:
          stats[0]?.materials_by_type?.filter((type) => type) || [],
      };

      return {
        status: 'success',
        message: 'Material statistics retrieved successfully',
        data: [result],
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve material statistics',
        data: [],
      });
    }
  }

  async getLowStockMaterials(
    threshold: number = 10,
  ): Promise<ResponseFormat<any>> {
    try {
      const materials = await this.materialModel
        .find({
          current_stock: {
            $elemMatch: {
              stock_quantity: { $lte: threshold, $gt: 0 },
            },
          },
        })
        .populate(
          'current_stock.location_id',
          'location_name location_code location_type',
        )
        .exec();

      const lowStockData = materials
        .map((material) => ({
          material_id: material._id,
          material_number: material.material_number,
          material_description: material.material_description,
          low_stock_locations: material.current_stock
            .filter(
              (stock) =>
                stock.stock_quantity <= threshold && stock.stock_quantity > 0,
            )
            .map((stock) => ({
              location: stock.location_id,
              stock_quantity: stock.stock_quantity,
              lot_number: stock.lot_number,
            })),
        }))
        .filter((material) => material.low_stock_locations.length > 0);

      return {
        status: 'success',
        message: `Found ${lowStockData.length} materials with low stock`,
        data: lowStockData,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve low stock materials',
        data: [],
      });
    }
  }
}
