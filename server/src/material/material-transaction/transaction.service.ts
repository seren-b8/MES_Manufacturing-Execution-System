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

import { MaterialService } from '../material.service';
import { LocationService } from '../material-location/location.service';
import * as moment from 'moment-timezone';
import { toObjectId } from 'src/shared/utils/type.utils';
import { ResponseFormat } from 'src/shared/interface';
import { ReceiveMaterialDto } from './dto/receive-material.dto';
import { ConsumeMaterialDto } from './dto/consume-material.dto';
import { ProductionOrder } from 'src/schema/production-order.schema';
import { MachineInfo } from 'src/schema/machine-info.schema';
import { TransferMaterialDto } from './dto/transfer-material.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { AssignOrder } from 'src/schema/assign-order.schema';

@Injectable()
export class TransactionService {
  constructor(
    @InjectModel(MaterialTransaction.name)
    private transactionModel: Model<MaterialTransaction>,
    @InjectModel(ProductionOrder.name)
    private productionOrderModel: Model<ProductionOrder>,
    @InjectModel(MachineInfo.name)
    private machineModel: Model<MachineInfo>,
    @InjectModel(MaterialPosition.name) // ← เพิ่มบรรทัดนี้
    private positionModel: Model<MaterialPosition>,
    @InjectModel(AssignOrder.name)
    private assignOrderModel: Model<AssignOrder>,

    private readonly materialService: MaterialService,
    private readonly locationService: LocationService,
  ) {}

  async receiveMaterial(
    dto: ReceiveMaterialDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      // 1. Validate material exists
      const material = await this.materialService.validateMaterialExists(
        dto.material_number,
      );

      // 2. Validate to_location exists
      const toLocation = await this.locationService.validateLocationExists(
        dto.to_location_code,
      );

      // 3. Validate position if provided
      let toPositionId = null;
      if (dto.to_position_code) {
        const position = await this.validatePositionInLocation(
          dto.to_position_code,
          toLocation._id.toString(),
        );
        toPositionId = position._id; // ← ใช้ position._id โดยตรง
      }

      // 4. Create transaction record
      const transaction = await this.transactionModel.create({
        transaction_type: 'receive',
        material_id: toObjectId(material._id as string),
        quantity: dto.quantity,
        to_location_id: toObjectId(toLocation._id as string),
        to_position_id: toPositionId, // ← ใช้ตรงนี้แทน
        reference_doc: dto.reference_doc,
        user_id: toObjectId(dto.user_id),
        transaction_date:
          dto.transaction_date || moment().tz('Asia/Bangkok').toDate(),
        lot_number: dto.lot_number,
      });

      // 5. Update material stock
      await this.materialService.addStockToLocation(
        dto.material_number,
        dto.to_location_code,
        dto.quantity,
        dto.to_position_code,
        dto.lot_number,
      );

      // 6. Populate and return
      const populatedTransaction = await this.transactionModel
        .findById(transaction._id)
        .populate(
          'material_id',
          'material_number material_description unit_of_measurement',
        )
        .populate('to_location_id', 'location_name location_code')
        .populate('to_position_id', 'position_code shelf_code')
        .populate('user_id', 'employee_id')
        .exec();

      return {
        status: 'success',
        message: `Received ${dto.quantity} units of ${dto.material_number} successfully`,
        data: [populatedTransaction],
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
        message: `Failed to receive material: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async transferMaterial(
    dto: TransferMaterialDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      // 1. Validate material exists
      const material = await this.materialService.validateMaterialExists(
        dto.material_number,
      );

      // 2. Validate both locations exist
      const fromLocation = await this.locationService.validateLocationExists(
        dto.from_location_code,
      );
      const toLocation = await this.locationService.validateLocationExists(
        dto.to_location_code,
      );

      // 3. Validate positions if provided
      let fromPositionId = null;
      let toPositionId = null;

      if (dto.from_position_code) {
        const position = await this.validatePositionInLocation(
          dto.from_position_code,
          fromLocation._id.toString(),
        );
        fromPositionId = position._id;
      }

      if (dto.to_position_code) {
        const position = await this.validatePositionInLocation(
          dto.to_position_code,
          toLocation._id.toString(),
        );
        toPositionId = position._id;
      }

      // 4. Check stock availability at from_location
      const hasStock = await this.materialService.checkStockAvailability(
        dto.material_number,
        dto.from_location_code,
        dto.quantity,
      );

      if (!hasStock) {
        throw new BadRequestException(
          `Insufficient stock at ${dto.from_location_code}. Required: ${dto.quantity}`,
        );
      }

      // 5. Create transaction record
      const transaction = await this.transactionModel.create({
        transaction_type: 'transfer',
        material_id: toObjectId(material._id as string),
        quantity: dto.quantity,
        from_location_id: toObjectId(fromLocation._id as string),
        to_location_id: toObjectId(toLocation._id as string),
        from_position_id: fromPositionId,
        to_position_id: toPositionId,
        reference_doc: dto.reference_doc,
        user_id: toObjectId(dto.user_id),
        transaction_date:
          dto.transaction_date || moment().tz('Asia/Bangkok').toDate(),
        lot_number: dto.lot_number,
      });

      // 6. Update material stock (remove from source, add to destination)
      await this.executeStockUpdate(
        dto.material_number,
        dto.from_location_code,
        dto.to_location_code,
        dto.quantity,
        dto.from_position_code,
        dto.to_position_code,
        dto.lot_number,
      );

      // 7. Populate and return
      const populatedTransaction = await this.transactionModel
        .findById(transaction._id)
        .populate(
          'material_id',
          'material_number material_description unit_of_measurement',
        )
        .populate('from_location_id', 'location_name location_code')
        .populate('from_position_id', 'position_code shelf_code')
        .populate('to_location_id', 'location_name location_code')
        .populate('to_position_id', 'position_code shelf_code')
        .populate('user_id', 'employee_id')
        .exec();

      return {
        status: 'success',
        message: `Transferred ${dto.quantity} units from ${dto.from_location_code} to ${dto.to_location_code}`,
        data: [populatedTransaction],
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
        message: `Failed to transfer material: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async consumeMaterial(
    dto: ConsumeMaterialDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      // 1. Validate material exists
      const material = await this.materialService.validateMaterialExists(
        dto.material_number,
      );

      // 2. Validate machine (required)
      const machine = await this.machineModel
        .findOne({ machine_number: dto.machine_number })
        .exec();

      if (!machine) {
        throw new NotFoundException(`Machine ${dto.machine_number} not found`);
      }

      // 3. Find active assign_order for this machine (auto-link if exists)
      const activeAssignOrder = await this.assignOrderModel
        .findOne({
          machine_number: dto.machine_number,
          status: 'active',
        })
        .populate('production_order_id')
        .exec();

      // 4. Validate from_location exists
      const fromLocation = await this.locationService.validateLocationExists(
        dto.from_location_code,
      );

      // 5. Validate position if provided
      let fromPositionId = null;
      if (dto.from_position_code) {
        const position = await this.positionModel
          .findOne({
            position_code: dto.from_position_code,
            location_id: toObjectId(fromLocation._id as string),
          })
          .exec();

        if (!position) {
          throw new NotFoundException(
            `Position ${dto.from_position_code} not found in location ${dto.from_location_code}`,
          );
        }

        fromPositionId = toObjectId(position._id as string);
      }

      // 6. Check stock availability
      const hasStock = await this.materialService.checkStockAvailability(
        dto.material_number,
        dto.from_location_code,
        dto.quantity,
      );

      if (!hasStock) {
        throw new BadRequestException(
          `Insufficient stock at ${dto.from_location_code}. Required: ${dto.quantity}`,
        );
      }

      // 7. Create transaction record
      const transaction = await this.transactionModel.create({
        transaction_type: 'consume',
        material_id: toObjectId(material._id as string),
        quantity: dto.quantity,
        from_location_id: toObjectId(fromLocation._id as string),
        from_position_id: fromPositionId,
        machine_id: toObjectId(machine._id as string),
        production_order_id:
          activeAssignOrder?.production_order_id?._id || null,
        lot_number: dto.lot_number,
        reference_doc:
          dto.reference_doc ||
          `CONSUME-${machine.machine_number}-${Date.now()}`,
        user_id: toObjectId(dto.user_id),
        transaction_date:
          dto.transaction_date || moment().tz('Asia/Bangkok').toDate(),
      });

      // 8. Update material stock (remove from location)
      await this.materialService.removeStockFromLocation(
        dto.material_number,
        dto.from_location_code,
        dto.quantity,
        dto.from_position_code,
        dto.lot_number,
      );

      // 9. Populate and return
      const populatedTransaction = await this.transactionModel
        .findById(transaction._id)
        .populate(
          'material_id',
          'material_number material_description unit_of_measurement',
        )
        .populate('from_location_id', 'location_name location_code')
        .populate('from_position_id', 'position_code shelf_code')
        .populate('machine_id', 'machine_number machine_name')
        .populate('production_order_id', 'order_id material_number')
        .populate('user_id', 'employee_id')
        .exec();

      // 10. Build success message
      let message = `Consumed ${dto.quantity} units of ${dto.material_number} at machine ${dto.machine_number}`;

      // Add order info if exists
      if (activeAssignOrder?.production_order_id) {
        const orderData = activeAssignOrder.production_order_id as any;
        message += ` (Order: ${orderData.order_id || 'N/A'})`;
      }

      return {
        status: 'success',
        message,
        data: [populatedTransaction],
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
        message: `Failed to consume material: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Query Methods =====

  async findAll(
    query: QueryTransactionDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      const {
        transaction_type,
        material_number,
        location_code,
        user_id,
        production_order_id,
        machine_number,
        start_date,
        end_date,
        page = 1,
        limit = 50,
      } = query;

      // Build filter
      const filter: any = {};

      if (transaction_type) {
        filter.transaction_type = transaction_type;
      }

      // Material filter
      if (material_number) {
        const material =
          await this.materialService.validateMaterialExists(material_number);
        filter.material_id = material._id;
      }

      // Location filter (from or to)
      if (location_code) {
        const location =
          await this.locationService.validateLocationExists(location_code);
        filter.$or = [
          { from_location_id: location._id },
          { to_location_id: location._id },
        ];
      }

      // User filter
      if (user_id && Types.ObjectId.isValid(user_id)) {
        filter.user_id = toObjectId(user_id);
      }

      // Production order filter
      if (production_order_id && Types.ObjectId.isValid(production_order_id)) {
        filter.production_order_id = toObjectId(production_order_id);
      }

      // Machine filter
      if (machine_number) {
        const machine = await this.machineModel
          .findOne({ machine_number })
          .exec();
        if (machine) {
          filter.machine_id = machine._id;
        }
      }

      // Date range filter
      if (start_date || end_date) {
        filter.transaction_date = {};
        if (start_date) {
          filter.transaction_date.$gte = new Date(start_date);
        }
        if (end_date) {
          filter.transaction_date.$lte = new Date(end_date);
        }
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const transactions = await this.transactionModel
        .find(filter)
        .sort({ transaction_date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(
          'material_id',
          'material_number material_description unit_of_measurement',
        )
        .populate('from_location_id', 'location_name location_code')
        .populate('to_location_id', 'location_name location_code')
        .populate('production_order_id', 'order_id material_number')
        .populate('machine_id', 'machine_number machine_name')
        .populate('user_id', 'employee_id')
        .exec();

      const total = await this.transactionModel.countDocuments(filter);

      return {
        status: 'success',
        message: `Found ${transactions.length} transactions (Total: ${total})`,
        data: transactions,
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
        message: `Failed to fetch transactions: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findByMaterial(
    materialNumber: string,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      const material =
        await this.materialService.validateMaterialExists(materialNumber);

      const transactions = await this.transactionModel
        .find({ material_id: material._id })
        .sort({ transaction_date: -1 })
        .populate('from_location_id', 'location_name location_code')
        .populate('to_location_id', 'location_name location_code')
        .populate('production_order_id', 'order_id')
        .populate('user_id', 'employee_id')
        .exec();

      return {
        status: 'success',
        message: `Found ${transactions.length} transactions for material ${materialNumber}`,
        data: transactions,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch material transactions: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findByLocation(
    locationCode: string,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      const location =
        await this.locationService.validateLocationExists(locationCode);

      const transactions = await this.transactionModel
        .find({
          $or: [
            { from_location_id: location._id },
            { to_location_id: location._id },
          ],
        })
        .sort({ transaction_date: -1 })
        .populate('material_id', 'material_number material_description')
        .populate('from_location_id', 'location_name location_code')
        .populate('to_location_id', 'location_name location_code')
        .populate('user_id', 'employee_id')
        .exec();

      return {
        status: 'success',
        message: `Found ${transactions.length} transactions for location ${locationCode}`,
        data: transactions,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch location transactions: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findByProductionOrder(
    orderId: string,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      if (!Types.ObjectId.isValid(orderId)) {
        throw new BadRequestException('Invalid production order ID format');
      }

      const transactions = await this.transactionModel
        .find({ production_order_id: toObjectId(orderId) })
        .sort({ transaction_date: -1 })
        .populate(
          'material_id',
          'material_number material_description unit_of_measurement',
        )
        .populate('from_location_id', 'location_name location_code')
        .populate('machine_id', 'machine_number machine_name')
        .populate('user_id', 'employee_id')
        .exec();

      return {
        status: 'success',
        message: `Found ${transactions.length} material transactions for this production order`,
        data: transactions,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch production order transactions: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async findByUser(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      const filter: any = { user_id: toObjectId(userId) };

      if (startDate || endDate) {
        filter.transaction_date = {};
        if (startDate) filter.transaction_date.$gte = startDate;
        if (endDate) filter.transaction_date.$lte = endDate;
      }

      const transactions = await this.transactionModel
        .find(filter)
        .sort({ transaction_date: -1 })
        .populate('material_id', 'material_number material_description')
        .populate('from_location_id', 'location_name location_code')
        .populate('to_location_id', 'location_name location_code')
        .exec();

      return {
        status: 'success',
        message: `Found ${transactions.length} transactions by this user`,
        data: transactions,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch user transactions: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  // ===== Statistics =====

  async getTransactionSummary(
    materialNumber: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    try {
      const material =
        await this.materialService.validateMaterialExists(materialNumber);

      const transactions = await this.transactionModel
        .find({
          material_id: material._id,
          transaction_date: { $gte: startDate, $lte: endDate },
        })
        .exec();

      const summary = {
        material_number: materialNumber,
        period: { start: startDate, end: endDate },
        total_received: 0,
        total_transferred: 0,
        total_consumed: 0,
        net_change: 0,
        transaction_count: transactions.length,
      };

      transactions.forEach((txn) => {
        switch (txn.transaction_type) {
          case 'receive':
            summary.total_received += txn.quantity;
            break;
          case 'transfer':
            summary.total_transferred += txn.quantity;
            break;
          case 'consume':
            summary.total_consumed += txn.quantity;
            break;
        }
      });

      summary.net_change = summary.total_received - summary.total_consumed;

      return {
        status: 'success',
        message: 'Transaction summary retrieved successfully',
        data: [summary],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to get summary: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  async getConsumptionByMachine(
    machineNumber: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ResponseFormat<any>> {
    try {
      const machine = await this.machineModel
        .findOne({ machine_number: machineNumber })
        .exec();

      if (!machine) {
        throw new NotFoundException(`Machine ${machineNumber} not found`);
      }

      const transactions = await this.transactionModel
        .find({
          machine_id: machine._id,
          transaction_type: 'consume',
          transaction_date: { $gte: startDate, $lte: endDate },
        })
        .populate(
          'material_id',
          'material_number material_description unit_of_measurement',
        )
        .exec();

      // Group by material
      const consumptionMap = new Map();

      transactions.forEach((txn: any) => {
        const matNum = txn.material_id.material_number;
        if (!consumptionMap.has(matNum)) {
          consumptionMap.set(matNum, {
            material_number: matNum,
            material_description: txn.material_id.material_description,
            unit: txn.material_id.unit_of_measurement,
            total_consumed: 0,
            transaction_count: 0,
          });
        }
        const record = consumptionMap.get(matNum);
        record.total_consumed += txn.quantity;
        record.transaction_count += 1;
      });

      const summary = Array.from(consumptionMap.values());

      return {
        status: 'success',
        message: `Material consumption for machine ${machineNumber}`,
        data: summary,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to get consumption data: ${(error as Error).message}`,
        data: [],
      });
    }
  }

  private async executeStockUpdate(
    materialNumber: string,
    fromLocationCode: string,
    toLocationCode: string,
    quantity: number,
    fromPositionCode?: string,
    toPositionCode?: string,
    lotNumber?: string,
  ): Promise<void> {
    try {
      // Remove from source
      await this.materialService.removeStockFromLocation(
        materialNumber,
        fromLocationCode,
        quantity,
        fromPositionCode,
        lotNumber,
      );

      // Add to destination
      await this.materialService.addStockToLocation(
        materialNumber,
        toLocationCode,
        quantity,
        toPositionCode,
        lotNumber,
      );
    } catch (error) {
      throw new BadRequestException(
        `Stock update failed: ${(error as Error).message}`,
      );
    }
  }

  private async validatePositionInLocation(
    positionCode: string,
    locationId: string,
  ): Promise<MaterialPosition> {
    // ← เปลี่ยน return type
    const position = await this.positionModel
      .findOne({
        position_code: positionCode,
        location_id: toObjectId(locationId),
      })
      .exec();

    if (!position) {
      throw new NotFoundException(
        `Position ${positionCode} not found in this location`,
      );
    }

    return position; // ← return position object
  }
}
