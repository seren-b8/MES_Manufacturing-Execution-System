// src/material/material-transaction/transaction.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MaterialTransaction } from '../../schema/material-transaction.schema';
import { MaterialPosition } from '../../schema/material-position.schema';
import { ReceiveMaterialDto } from '../dto/receive-material.dto';
import { TransferMaterialDto } from '../dto/transfer-material.dto';
import { ConsumeMaterialDto } from '../dto/consume-material.dto';
import { TransactionFiltersDto } from '../dto/transaction-filters.dto';
import { MaterialService } from '../material.service';
import { LocationService } from '../material-location/location.service';
import * as moment from 'moment-timezone';
import { toObjectId } from 'src/shared/utils/type.utils';
import { ResponseFormat } from 'src/shared/interface';

@Injectable()
export class TransactionService {
  constructor(
    @InjectModel(MaterialTransaction.name)
    private readonly transactionModel: Model<MaterialTransaction>,
    @InjectModel(MaterialPosition.name)
    private readonly positionModel: Model<MaterialPosition>,
    private readonly materialService: MaterialService,
    private readonly locationService: LocationService,
  ) {}

  async receiveMaterial(
    dto: ReceiveMaterialDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      // Validate material exists
      const materialExists = await this.materialService.validateMaterialExists(
        dto.material_id,
      );
      if (!materialExists) {
        throw new BadRequestException({
          status: 'error',
          message: 'Material does not exist',
          data: [],
        });
      }

      // Validate location exists
      const locationExists = await this.locationService.validateLocationExists(
        dto.to_location_id,
      );
      if (!locationExists) {
        throw new BadRequestException({
          status: 'error',
          message: 'Location does not exist',
          data: [],
        });
      }

      // Handle position validation if provided
      let positionId: Types.ObjectId | null = null;
      if (dto.to_position_code) {
        const positionResult = await this.validateAndHandlePosition(
          dto.to_location_id,
          dto.to_position_code,
          dto.material_id,
          dto.quantity,
          'receive',
          dto.lot_number,
        );
        positionId = positionResult.position_id;
      }

      // Create transaction record
      const transactionData = {
        transaction_type: 'receive',
        material_id: toObjectId(dto.material_id),
        quantity: dto.quantity,
        transaction_date: moment().tz('Asia/Bangkok').toDate(),
        to_location_id: toObjectId(dto.to_location_id),
        user_id: toObjectId(dto.user_id),
        reference_doc: dto.reference_doc || null,
        position_code: dto.to_position_code || null,
        lot_number: dto.lot_number || null,
      };

      const transaction = new this.transactionModel(transactionData);
      const savedTransaction = await transaction.save();

      try {
        // Update material stock
        const currentStock = await this.materialService.getAvailableStock(
          dto.material_id,
          dto.to_location_id,
        );

        if (currentStock === 0) {
          // Initialize stock if doesn't exist
          await this.materialService.initializeStock({
            material_id: dto.material_id,
            location_id: dto.to_location_id,
            quantity: dto.quantity,
          });
        } else {
          // Add to existing stock
          await this.materialService.updateStock(
            dto.material_id,
            dto.to_location_id,
            dto.quantity,
            'add',
          );
        }

        // Update position if applicable
        if (positionId) {
          await this.updatePositionMaterials(
            positionId,
            dto.material_id,
            dto.quantity,
            'add',
            dto.lot_number,
          );
        }
      } catch (stockError) {
        // Rollback transaction if stock update fails
        await this.transactionModel.findByIdAndDelete(savedTransaction._id);
        throw new ConflictException({
          status: 'error',
          message: 'Failed to update stock: ' + (stockError as Error).message,
          data: [],
        });
      }

      // Populate transaction for response
      const populatedTransaction = await this.populateTransaction(
        savedTransaction._id,
      );

      return {
        status: 'success',
        message: 'Material received successfully',
        data: [populatedTransaction],
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new ConflictException({
        status: 'error',
        message: (error as Error).message || 'Failed to receive material',
        data: [],
      });
    }
  }

  async transferMaterial(
    dto: TransferMaterialDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      // Validate material exists
      const materialExists = await this.materialService.validateMaterialExists(
        dto.material_id,
      );
      if (!materialExists) {
        throw new BadRequestException({
          status: 'error',
          message: 'Material does not exist',
          data: [],
        });
      }

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

      // Handle position validations
      let fromPositionId: Types.ObjectId | null = null;
      let toPositionId: Types.ObjectId | null = null;

      // Validate source position if provided
      if (dto.from_position_code) {
        const fromPositionResult = await this.validateAndHandlePosition(
          dto.from_location_id,
          dto.from_position_code,
          dto.material_id,
          dto.quantity,
          'validate_source',
          dto.lot_number,
        );
        fromPositionId = fromPositionResult.position_id;
      }

      // Validate destination position if provided
      if (dto.to_position_code) {
        const toPositionResult = await this.validateAndHandlePosition(
          dto.to_location_id,
          dto.to_position_code,
          dto.material_id,
          dto.quantity,
          'receive',
          dto.lot_number,
        );
        toPositionId = toPositionResult.position_id;
      }

      // Check available stock at source location
      let availableStock: number;
      if (fromPositionId) {
        availableStock = await this.getPositionMaterialStock(
          fromPositionId,
          dto.material_id,
          dto.lot_number,
        );
      } else {
        availableStock = await this.materialService.getAvailableStock(
          dto.material_id,
          dto.from_location_id,
        );
      }

      if (availableStock < dto.quantity) {
        throw new BadRequestException({
          status: 'error',
          message: `Insufficient stock. Available: ${availableStock}, Requested: ${dto.quantity}`,
          data: [],
        });
      }

      // Create transaction record
      const transactionData = {
        transaction_type: 'transfer',
        material_id: toObjectId(dto.material_id),
        quantity: dto.quantity,
        transaction_date: moment().tz('Asia/Bangkok').toDate(),
        from_location_id: toObjectId(dto.from_location_id),
        to_location_id: toObjectId(dto.to_location_id),
        user_id: toObjectId(dto.user_id),
        reference_doc: dto.reference_doc || null,
        from_position_code: dto.from_position_code || null,
        to_position_code: dto.to_position_code || null,
        lot_number: dto.lot_number || null,
      };

      const transaction = new this.transactionModel(transactionData);
      const savedTransaction = await transaction.save();

      try {
        // Update material stock using MaterialService transferStock method
        await this.materialService.transferStock({
          material_id: dto.material_id,
          from_location_id: dto.from_location_id,
          to_location_id: dto.to_location_id,
          quantity: dto.quantity,
        });

        // Update positions if applicable
        if (fromPositionId) {
          await this.updatePositionMaterials(
            fromPositionId,
            dto.material_id,
            dto.quantity,
            'subtract',
            dto.lot_number,
          );
        }

        if (toPositionId) {
          await this.updatePositionMaterials(
            toPositionId,
            dto.material_id,
            dto.quantity,
            'add',
            dto.lot_number,
          );
        }
      } catch (stockError) {
        // Rollback transaction if stock update fails
        await this.transactionModel.findByIdAndDelete(savedTransaction._id);
        throw new ConflictException({
          status: 'error',
          message: 'Failed to update stock: ' + (stockError as Error).message,
          data: [],
        });
      }

      // Populate transaction for response
      const populatedTransaction = await this.populateTransaction(
        savedTransaction._id,
      );

      return {
        status: 'success',
        message: 'Material transferred successfully',
        data: [populatedTransaction],
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new ConflictException({
        status: 'error',
        message: (error as Error).message || 'Failed to transfer material',
        data: [],
      });
    }
  }

  async consumeMaterial(
    dto: ConsumeMaterialDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      // Validate material exists
      const materialExists = await this.materialService.validateMaterialExists(
        dto.material_id,
      );
      if (!materialExists) {
        throw new BadRequestException({
          status: 'error',
          message: 'Material does not exist',
          data: [],
        });
      }

      // Validate location exists
      const locationExists = await this.locationService.validateLocationExists(
        dto.from_location_id,
      );
      if (!locationExists) {
        throw new BadRequestException({
          status: 'error',
          message: 'Location does not exist',
          data: [],
        });
      }

      // Handle position validation if provided
      let fromPositionId: Types.ObjectId | null = null;
      if (dto.from_position_code) {
        const positionResult = await this.validateAndHandlePosition(
          dto.from_location_id,
          dto.from_position_code,
          dto.material_id,
          dto.quantity,
          'validate_source',
          dto.lot_number,
        );
        fromPositionId = positionResult.position_id;
      }

      // Check available stock
      let availableStock: number;
      if (fromPositionId) {
        availableStock = await this.getPositionMaterialStock(
          fromPositionId,
          dto.material_id,
          dto.lot_number,
        );
      } else {
        availableStock = await this.materialService.getAvailableStock(
          dto.material_id,
          dto.from_location_id,
        );
      }

      if (availableStock < dto.quantity) {
        throw new BadRequestException({
          status: 'error',
          message: `Insufficient stock. Available: ${availableStock}, Requested: ${dto.quantity}`,
          data: [],
        });
      }

      // Create transaction record
      const transactionData = {
        transaction_type: 'consume',
        material_id: toObjectId(dto.material_id),
        quantity: dto.quantity,
        transaction_date: moment().tz('Asia/Bangkok').toDate(),
        from_location_id: toObjectId(dto.from_location_id),
        user_id: toObjectId(dto.user_id),
        production_order_id: dto.production_order_id
          ? toObjectId(dto.production_order_id)
          : null,
        machine_id: dto.machine_id ? toObjectId(dto.machine_id) : null,
        reference_doc: dto.reference_doc || null,
        from_position_code: dto.from_position_code || null,
        lot_number: dto.lot_number || null,
      };

      const transaction = new this.transactionModel(transactionData);
      const savedTransaction = await transaction.save();

      try {
        // Update stock - subtract from location
        await this.materialService.updateStock(
          dto.material_id,
          dto.from_location_id,
          dto.quantity,
          'subtract',
        );

        // Update position if applicable
        if (fromPositionId) {
          await this.updatePositionMaterials(
            fromPositionId,
            dto.material_id,
            dto.quantity,
            'subtract',
            dto.lot_number,
          );
        }
      } catch (stockError) {
        // Rollback transaction if stock update fails
        await this.transactionModel.findByIdAndDelete(savedTransaction._id);
        throw new ConflictException({
          status: 'error',
          message: 'Failed to update stock: ' + (stockError as Error).message,
          data: [],
        });
      }

      // Populate transaction for response
      const populatedTransaction = await this.populateTransaction(
        savedTransaction._id,
      );

      return {
        status: 'success',
        message: 'Material consumed successfully',
        data: [populatedTransaction],
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new ConflictException({
        status: 'error',
        message: (error as Error).message || 'Failed to consume material',
        data: [],
      });
    }
  }

  // Position handling methods
  private async validateAndHandlePosition(
    locationId: string,
    positionCode: string,
    materialId: string,
    quantity: number,
    operation: 'receive' | 'validate_source',
    lotNumber?: string,
  ): Promise<{ position_id: Types.ObjectId }> {
    // Check if location supports positions
    const locationSupportsPositions =
      await this.locationService.validateLocationSupportsPositions(locationId);
    if (!locationSupportsPositions) {
      throw new BadRequestException({
        status: 'error',
        message: 'Location does not support positions',
        data: [],
      });
    }

    // Find or create position
    let position = await this.positionModel.findOne({
      location_id: toObjectId(locationId),
      position_code: positionCode,
    });

    if (!position && operation === 'receive') {
      // Create new position for receive operations
      position = new this.positionModel({
        location_id: toObjectId(locationId),
        position_code: positionCode,
        current_materials: [],
      });
      await position.save();
    } else if (!position && operation === 'validate_source') {
      throw new NotFoundException({
        status: 'error',
        message: `Position ${positionCode} not found in location`,
        data: [],
      });
    }

    // For receive operations, check capacity if defined
    if (operation === 'receive' && position.max_capacity) {
      const currentTotal = position.current_materials.reduce(
        (sum, mat) => sum + mat.quantity,
        0,
      );
      if (currentTotal + quantity > position.max_capacity) {
        throw new BadRequestException({
          status: 'error',
          message: `Position capacity exceeded. Available: ${position.max_capacity - currentTotal}, Requested: ${quantity}`,
          data: [],
        });
      }
    }

    // For source validation, check if material exists with sufficient quantity
    if (operation === 'validate_source') {
      const materialInPosition = position.current_materials.find((mat) => {
        const materialMatch = mat.material_id.toString() === materialId;
        const lotMatch = !lotNumber || mat.lot_number === lotNumber;
        return materialMatch && lotMatch;
      });

      if (!materialInPosition || materialInPosition.quantity < quantity) {
        const available = materialInPosition?.quantity || 0;
        throw new BadRequestException({
          status: 'error',
          message: `Insufficient material in position. Available: ${available}, Requested: ${quantity}`,
          data: [],
        });
      }
    }

    return { position_id: toObjectId(position._id.toString()) };
  }

  private async updatePositionMaterials(
    positionId: Types.ObjectId,
    materialId: string,
    quantity: number,
    operation: 'add' | 'subtract',
    lotNumber?: string,
  ): Promise<void> {
    const position = await this.positionModel.findById(positionId);
    if (!position) {
      throw new NotFoundException('Position not found');
    }

    const materialIndex = position.current_materials.findIndex((mat) => {
      const materialMatch = mat.material_id.toString() === materialId;
      const lotMatch = !lotNumber || mat.lot_number === lotNumber;
      return materialMatch && lotMatch;
    });

    if (operation === 'add') {
      if (materialIndex >= 0) {
        // Update existing material
        position.current_materials[materialIndex].quantity += quantity;
      } else {
        // Add new material
        position.current_materials.push({
          material_id: toObjectId(materialId),
          quantity: quantity,
          lot_number: lotNumber,
        });
      }
    } else if (operation === 'subtract') {
      if (materialIndex >= 0) {
        position.current_materials[materialIndex].quantity -= quantity;

        // Remove material if quantity becomes 0
        if (position.current_materials[materialIndex].quantity <= 0) {
          position.current_materials.splice(materialIndex, 1);
        }
      }
    }

    // Update is_occupied status
    position.is_occupied = position.current_materials.length > 0;

    await position.save();
  }

  private async getPositionMaterialStock(
    positionId: Types.ObjectId,
    materialId: string,
    lotNumber?: string,
  ): Promise<number> {
    const position = await this.positionModel.findById(positionId);
    if (!position) return 0;

    const material = position.current_materials.find((mat) => {
      const materialMatch = mat.material_id.toString() === materialId;
      const lotMatch = !lotNumber || mat.lot_number === lotNumber;
      return materialMatch && lotMatch;
    });

    return material?.quantity || 0;
  }

  private async populateTransaction(
    transactionId: Types.ObjectId,
  ): Promise<MaterialTransaction> {
    return await this.transactionModel
      .findById(transactionId)
      .populate('material_id', 'material_number material_description')
      .populate('from_location_id', 'location_name location_code location_type')
      .populate('to_location_id', 'location_name location_code location_type')
      .populate('user_id', 'employee_id')
      .populate('production_order_id', 'order_id material_number')
      .populate('machine_id', 'machine_number machine_name')
      .exec();
  }

  // Existing methods with position support added
  async getTransactionHistory(
    filters: TransactionFiltersDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      const query: any = {};

      // Apply existing filters
      if (filters.material_id) {
        query.material_id = toObjectId(filters.material_id);
      }

      if (filters.location_id) {
        query.$or = [
          { from_location_id: toObjectId(filters.location_id) },
          { to_location_id: toObjectId(filters.location_id) },
        ];
      }

      if (filters.user_id) {
        query.user_id = toObjectId(filters.user_id);
      }

      if (filters.transaction_type) {
        query.transaction_type = filters.transaction_type;
      }

      if (filters.production_order_id) {
        query.production_order_id = toObjectId(filters.production_order_id);
      }

      if (filters.machine_id) {
        query.machine_id = toObjectId(filters.machine_id);
      }

      // Date range filter
      if (filters.start_date || filters.end_date) {
        query.transaction_date = {};

        if (filters.start_date) {
          query.transaction_date.$gte = moment(filters.start_date)
            .tz('Asia/Bangkok')
            .startOf('day')
            .toDate();
        }

        if (filters.end_date) {
          query.transaction_date.$lte = moment(filters.end_date)
            .tz('Asia/Bangkok')
            .endOf('day')
            .toDate();
        }
      }

      const transactions = await this.transactionModel
        .find(query)
        .populate('material_id', 'material_number material_description')
        .populate(
          'from_location_id',
          'location_name location_code location_type',
        )
        .populate('to_location_id', 'location_name location_code location_type')
        .populate('user_id', 'employee_id')
        .populate('production_order_id', 'order_id material_number')
        .populate('machine_id', 'machine_number machine_name')
        .sort({ transaction_date: -1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${transactions.length} transactions`,
        data: transactions,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve transaction history',
        data: [],
      });
    }
  }

  // Position-specific query methods
  async getTransactionsByPosition(
    locationId: string,
    positionCode: string,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      const transactions = await this.transactionModel
        .find({
          $or: [
            {
              from_location_id: toObjectId(locationId),
              from_position_code: positionCode,
            },
            {
              to_location_id: toObjectId(locationId),
              to_position_code: positionCode,
            },
          ],
        })
        .populate('material_id', 'material_number material_description')
        .populate(
          'from_location_id',
          'location_name location_code location_type',
        )
        .populate('to_location_id', 'location_name location_code location_type')
        .populate('user_id', 'employee_id')
        .sort({ transaction_date: -1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${transactions.length} transactions for position ${positionCode}`,
        data: transactions,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve position transactions',
        data: [],
      });
    }
  }

  async getPositionCurrentStock(
    locationId: string,
    positionCode: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const position = await this.positionModel
        .findOne({
          location_id: toObjectId(locationId),
          position_code: positionCode,
        })
        .populate(
          'current_materials.material_id',
          'material_number material_description',
        )
        .exec();

      if (!position) {
        throw new NotFoundException({
          status: 'error',
          message: 'Position not found',
          data: [],
        });
      }

      return {
        status: 'success',
        message: 'Position stock retrieved successfully',
        data: [position],
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

  // Keep all existing methods unchanged...
  async getTransactionById(
    id: string,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      const transaction = await this.populateTransaction(toObjectId(id));

      if (!transaction) {
        throw new NotFoundException({
          status: 'error',
          message: 'Transaction not found',
          data: [],
        });
      }

      return {
        status: 'success',
        message: 'Transaction retrieved successfully',
        data: [transaction],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve transaction',
        data: [],
      });
    }
  }

  async getTransactionsByMaterial(
    materialId: string,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    return this.getTransactionHistory({ material_id: materialId });
  }

  async getTransactionsByLocation(
    locationId: string,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    return this.getTransactionHistory({ location_id: locationId });
  }

  async getTransactionsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    return this.getTransactionHistory({
      start_date: startDate,
      end_date: endDate,
    });
  }

  async processBulkConsumption(
    consumptions: ConsumeMaterialDto[],
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      const results = [];
      const errors = [];

      for (const consumption of consumptions) {
        try {
          const result = await this.consumeMaterial(consumption);
          results.push(result.data[0]);
        } catch (error) {
          errors.push({
            material_id: consumption.material_id,
            position_code: consumption.from_position_code,
            error: (error as Error).message,
          });
        }
      }

      if (errors.length > 0 && results.length === 0) {
        throw new BadRequestException({
          status: 'error',
          message: 'All bulk consumption operations failed',
          data: [],
        });
      }

      return {
        status: results.length > 0 ? 'success' : 'error',
        message: `Processed ${results.length} successful transactions, ${errors.length} failed`,
        data: results,
      };
    } catch (error) {
      throw new ConflictException({
        status: 'error',
        message: 'Failed to process bulk consumption',
        data: [],
      });
    }
  }

  async getMaterialConsumptionSummary(
    materialId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const matchStage: any = {
        material_id: toObjectId(materialId),
        transaction_type: 'consume',
      };

      if (startDate || endDate) {
        matchStage.transaction_date = {};
        if (startDate) {
          matchStage.transaction_date.$gte = moment(startDate)
            .tz('Asia/Bangkok')
            .startOf('day')
            .toDate();
        }
        if (endDate) {
          matchStage.transaction_date.$lte = moment(endDate)
            .tz('Asia/Bangkok')
            .endOf('day')
            .toDate();
        }
      }

      const summary = await this.transactionModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$material_id',
            total_consumed: { $sum: '$quantity' },
            transaction_count: { $sum: 1 },
            avg_consumption: { $avg: '$quantity' },
            first_consumption: { $min: '$transaction_date' },
            last_consumption: { $max: '$transaction_date' },
            positions_used: { $addToSet: '$from_position_code' },
          },
        },
      ]);

      return {
        status: 'success',
        message: 'Consumption summary retrieved successfully',
        data: summary,
      };
    } catch (error) {
      throw new NotFoundException({
        status: 'error',
        message: 'Failed to retrieve consumption summary',
        data: [],
      });
    }
  }
}
