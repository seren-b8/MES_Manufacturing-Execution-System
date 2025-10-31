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
import { number } from 'yargs';
import { User } from 'src/schema/user.schema';
import { Material } from 'src/schema/material.schema';
import { MaterialModule } from '../material.module';
import { MaterialReceiptItem } from 'src/schema/material-receipt-items';
import { MaterialReceipt } from 'src/schema/material-receipts.schema';

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
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Material.name)
    private materialModel: Model<Material>,
    @InjectModel(MaterialReceiptItem.name)
    private receiptItemModel: Model<MaterialReceiptItem>,
    @InjectModel(MaterialReceipt.name)
    private receiptModel: Model<MaterialReceipt>,

    private readonly materialService: MaterialService,
    private readonly locationService: LocationService,
  ) {}

  async receiveMaterial(
    dto: ReceiveMaterialDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    this.validateQuantity(dto.quantity); // ← เพิ่มบรรทัดนี้
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

    if (!populatedTransaction) {
      throw new NotFoundException('Transaction created but not found');
    }

    return {
      status: 'success',
      message: `Received ${dto.quantity} units of ${dto.material_number} successfully`,
      data: [populatedTransaction],
    };
  }

  async transferMaterial(
    dto: TransferMaterialDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    this.validateQuantity(dto.quantity); // ← เพิ่มบรรทัดนี้
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

    if (!populatedTransaction) {
      throw new NotFoundException('Transaction created but not found');
    }

    return {
      status: 'success',
      message: `Transferred ${dto.quantity} units from ${dto.from_location_code} to ${dto.to_location_code}`,
      data: [populatedTransaction],
    };
  }

  async consumeMaterial(
    dto: ConsumeMaterialDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    this.validateQuantity(dto.quantity); // ← เพิ่มบรรทัดนี้
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
      dto.from_position_code,
      dto.lot_number,
    );

    if (!hasStock) {
      const availableStock = await this.getAvailableStockForError(
        dto.material_number,
        dto.from_location_code,
        dto.from_position_code,
        dto.lot_number,
      );
      throw new BadRequestException(
        `Insufficient stock at ${dto.from_location_code}` +
          (dto.from_position_code ? ` (${dto.from_position_code})` : '') +
          (dto.lot_number ? ` [Lot: ${dto.lot_number}]` : '') +
          `. Available: ${availableStock}, Required: ${dto.quantity}`,
      );
    }
    await this.materialService.removeStockFromLocation(
      dto.material_number,
      dto.from_location_code,
      dto.quantity,
      dto.from_position_code,
      dto.lot_number,
    );
    try {
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

      if (!populatedTransaction) {
        throw new NotFoundException('Transaction created but not found');
      }

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
      // Rollback: Add stock back if transaction creation fails
      await this.materialService
        .addStockToLocation(
          dto.material_number,
          dto.from_location_code,
          dto.quantity,
          dto.from_position_code,
          dto.lot_number,
        )
        .catch((rollbackError) => {
          // Log rollback error but don't throw
          console.error('Failed to rollback stock:', rollbackError);
        });

      throw error;
    }
  }

  async cancelTransaction(dto: {
    transaction_id: string;
    cancellation_reason: string;
    user_id: string;
  }): Promise<ResponseFormat<MaterialTransaction>> {
    // 1. Validate transaction
    const transaction = await this.validateCancellableTransaction(
      dto.transaction_id,
    );

    const receiptItem = await this.receiptItemModel
      .findOne({ material_transaction_id: transaction._id })
      .exec();

    // 2. สร้าง Cancellation Transaction (ย้อนกลับ)
    const cancellationTx = await this.createCancellationTransaction(
      transaction,
      dto.user_id,
      dto.cancellation_reason,
    );

    // 3. Mark original as cancelled
    const cancelledTx = await this.transactionModel
      .findByIdAndUpdate(
        transaction._id,
        {
          is_cancelled: true,
          cancelled_by_transaction_id: cancellationTx._id,
          cancelled_by_user: toObjectId(dto.user_id),
          cancelled_at: moment().tz('Asia/Bangkok').toDate(),
          cancellation_reason: dto.cancellation_reason,
        },
        { new: true },
      )
      .populate('material_id', 'material_number material_description')
      .populate('to_location_id', 'location_code location_name')
      .populate('from_location_id', 'location_code location_name')
      .populate('to_position_id', 'position_code')
      .populate('from_position_id', 'position_code')
      .exec();

    if (!cancelledTx) {
      throw new NotFoundException('Failed to mark transaction as cancelled');
    }

    if (receiptItem) {
      const receipt = await this.receiptModel
        .findById(receiptItem.material_receipt_id)
        .exec();

      if (receipt) {
        receipt.processed_quantity -= receiptItem.quantity;
        receipt.remaining_quantity += receiptItem.quantity;

        if (receipt.remaining_quantity === receipt.total_received_quantity) {
          receipt.receipt_status = 'pending';
        } else if (receipt.remaining_quantity > 0) {
          receipt.receipt_status = 'partial';
        }

        await receipt.save();
      }
    }

    return {
      status: 'success',
      message: `Transaction cancelled successfully`,
      data: [cancelledTx, cancellationTx],
    };
  }

  // ===== Query Methods =====

  async findAll(
    query: QueryTransactionDto,
  ): Promise<ResponseFormat<MaterialTransaction>> {
    const {
      transaction_type,
      material_number,
      location_code,
      user_id,
      production_order_id,
      machine_number,
      start_date,
      end_date,
      lot_number,
    } = query;

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;

    const includeCancelled =
      query.include_cancelled === true || query.include_cancelled === 'true';

    // Build filter
    const filter: any = {};

    if (includeCancelled !== true) {
      filter.is_cancelled = { $ne: true };
    }

    if (transaction_type) {
      filter.transaction_type = transaction_type;
    }

    // Material filter
    if (material_number) {
      const material =
        await this.materialService.validateMaterialExists(material_number);
      filter.material_id = material._id;
    }

    // Lot number filter
    if (lot_number) {
      filter.lot_number = lot_number;
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

      // ตั้งค่าเวลาเริ่มต้น (start_date) เป็น 00:00:00 ของวันที่เลือก
      if (start_date) {
        filter.transaction_date.$gte = moment
          .tz(start_date, 'Asia/Bangkok')
          .startOf('day') // เพิ่ม .startOf('day') เพื่อให้แน่ใจว่าเป็น 00:00:00
          .toDate();
      }

      // ตั้งค่าเวลาสิ้นสุด (end_date) ให้ครอบคลุมทั้งวัน
      if (end_date) {
        // วิธีนี้รับประกันว่าครอบคลุมข้อมูลถึงวินาทีสุดท้ายของวันและเป็นมาตรฐานที่ดีกว่า
        filter.transaction_date.$lt = moment
          .tz(end_date, 'Asia/Bangkok')
          .add(1, 'days') // เพิ่มไป 1 วัน
          .startOf('day') // ตั้งเป็น 00:00:00 ของวันถัดไป
          .toDate();
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
      .populate('from_position_id', 'position_code shelf_code') // 👈 เพิ่ม
      .populate('to_location_id', 'location_name location_code')
      .populate('to_position_id', 'position_code shelf_code') // 👈 เพิ่ม
      .populate('production_order_id', 'order_id material_number')
      .populate('machine_id', 'machine_number machine_name')
      .populate('user_id', 'employee_id')
      .populate('cancelled_transaction_id') // ← เพิ่ม
      .populate('cancelled_by_transaction_id') // ← เพิ่ม
      .populate('cancelled_by_user', 'employee_id') // ← เพิ่ม
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
  }

  async summarizeConsumptionByShift(query: {
    date: string;
    shift: 'day' | 'night';
  }): Promise<ResponseFormat<any>> {
    const { date, shift } = query;
    if (!date || !shift) {
      throw new BadRequestException('Date and shift are required.');
    }

    const today = moment.tz(date, 'YYYY-MM-DD', 'Asia/Bangkok');
    if (!today.isValid()) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    let startDate: Date, endDate: Date;

    // 1. กำหนดช่วงเวลาตามกะ
    if (shift === 'day') {
      startDate = today.clone().hour(8).minute(0).second(0).toDate();
      endDate = today.clone().hour(20).minute(0).second(0).toDate();
    } else if (shift === 'night') {
      startDate = today.clone().hour(20).minute(0).second(0).toDate();
      endDate = today
        .clone()
        .add(1, 'day')
        .hour(8)
        .minute(0)
        .second(0)
        .toDate();
    } else {
      throw new BadRequestException(
        'Invalid shift value. Must be "day" or "night".',
      );
    }

    // 2. สร้าง Aggregation Pipeline
    const pipeline: any[] = [
      // Filter ตามประเภทธุรกรรมและช่วงเวลา
      {
        $match: {
          transaction_type: 'consume',
          is_cancelled: { $ne: true }, // ← เพิ่มบรรทัดนี้
          transaction_date: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      // Group เพื่อสรุปผลตาม Machine, Production Order, และ User
      {
        $group: {
          _id: {
            machineId: '$machine_id',
            productionOrderId: '$production_order_id',
            userId: '$user_id',
            materialId: '$material_id', // เพิ่ม Material ID เข้าไปเพื่อแยกสรุปตามวัตถุดิบ
          },
          total_quantity_consumed: { $sum: '$quantity' },
          count: { $sum: 1 },
        },
      },
      // Lookup (Join) ข้อมูล Machine
      {
        $lookup: {
          from: this.machineModel.collection.name, // ชื่อ Collection ของ MachineInfo
          localField: '_id.machineId',
          foreignField: '_id',
          as: 'machine_info',
        },
      },
      {
        $unwind: { path: '$machine_info', preserveNullAndEmptyArrays: true },
      },

      // Lookup (Join) ข้อมูล Production Order
      {
        $lookup: {
          from: this.productionOrderModel.collection.name, // ชื่อ Collection ของ ProductionOrder
          localField: '_id.productionOrderId',
          foreignField: '_id',
          as: 'production_order_info',
        },
      },
      {
        $unwind: {
          path: '$production_order_info',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lookup (Join) ข้อมูล User (สมมติชื่อ Collection เป็น 'users')
      {
        $lookup: {
          from: this.userModel.collection.name, // **อาจต้องเปลี่ยนชื่อ Collection ตามจริง**
          localField: '_id.userId',
          foreignField: '_id',
          as: 'user_info',
        },
      },
      { $unwind: { path: '$user_info', preserveNullAndEmptyArrays: true } },

      // Lookup (Join) ข้อมูล Material
      {
        $lookup: {
          from: this.materialModel.collection.name, // ชื่อ Collection ของ Material
          localField: '_id.materialId',
          foreignField: '_id',
          as: 'material_info',
        },
      },
      {
        $unwind: { path: '$material_info', preserveNullAndEmptyArrays: true },
      },

      // Project เพื่อจัดรูปแบบผลลัพธ์
      {
        $project: {
          _id: 0,
          machine_number: '$machine_info.machine_number',
          machine_name: '$machine_info.machine_name',
          production_order_id: {
            $ifNull: ['$production_order_info.order_id', 'N/A'],
          },
          consumed_by_employee: '$user_info.employee_id',
          consumed_by_name: '$user_info.name', // สมมติว่ามีฟิลด์ 'name' ใน User
          material_number: '$material_info.material_number',
          material_description: '$material_info.material_description',
          unit: '$material_info.unit_of_measurement',
          total_quantity_consumed: '$total_quantity_consumed',
          transaction_count: '$count',
        },
      },
      // จัดเรียงตาม Machine Number
      { $sort: { machine_number: 1, production_order_id: 1 } },
    ];

    const summary = await this.transactionModel.aggregate(pipeline).exec();

    return {
      status: 'success',
      message: `Found ${summary.length} consumption summary groups for ${date} (${shift} shift)`,
      data: summary,
    };
  }

  // ===== Private Helper Methods =====
  private async executeStockUpdate(
    materialNumber: string,
    fromLocationCode: string,
    toLocationCode: string,
    quantity: number,
    fromPositionCode?: string,
    toPositionCode?: string,
    lotNumber?: string,
  ): Promise<void> {
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

  private async validateCancellableTransaction(
    transactionId: string,
  ): Promise<MaterialTransaction> {
    // 1. ตรวจสอบ ObjectId format
    if (!Types.ObjectId.isValid(transactionId)) {
      throw new BadRequestException(`Invalid transaction ID format`);
    }

    // 2. ดึงข้อมูล transaction
    const transaction = await this.transactionModel
      .findById(transactionId)
      .populate('material_id', 'material_number material_description')
      .populate('to_location_id', 'location_code location_name')
      .populate('from_location_id', 'location_code location_name')
      .populate('to_position_id', 'position_code')
      .populate('from_position_id', 'position_code')
      .exec();

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // 3. ตรวจสอบว่าถูกยกเลิกไปแล้วหรือไม่
    if (transaction.is_cancelled) {
      throw new ConflictException('Transaction has already been cancelled');
    }

    // 4. ไม่สามารถยกเลิก cancellation transaction
    if (transaction.transaction_type === 'cancellation') {
      throw new BadRequestException('Cannot cancel a cancellation transaction');
    }

    // 5. ตรวจสอบช่วงเวลา (optional)
    const transactionAge = moment().diff(
      moment((transaction as any).createdAt),
      'hours',
    );

    const MAX_CANCELLATION_HOURS = 72; // 3 วัน

    if (transactionAge > MAX_CANCELLATION_HOURS) {
      throw new BadRequestException(
        `Transaction is too old to cancel (${transactionAge} hours). ` +
          `Maximum: ${MAX_CANCELLATION_HOURS} hours`,
      );
    }

    // 6. ตรวจสอบตามประเภท transaction
    if (transaction.transaction_type === 'receive') {
      return await this.validateCancellableReceive(transaction);
    } else if (transaction.transaction_type === 'transfer') {
      return await this.validateCancellableTransfer(transaction);
    } else if (transaction.transaction_type === 'consume') {
      return await this.validateCancellableConsume(transaction);
    }

    return transaction;
  }

  private async validateCancellableReceive(
    transaction: MaterialTransaction,
  ): Promise<MaterialTransaction> {
    // ตรวจสอบว่ามีสต็อกเพียงพอที่จะย้อนกลับ
    const hasStock = await this.materialService.checkStockAvailability(
      (transaction.material_id as any).material_number,
      (transaction.to_location_id as any).location_code,
      transaction.quantity,
      (transaction.to_position_id as any).position_code,
      transaction.lot_number,
    );

    if (!hasStock) {
      throw new BadRequestException(
        `Cannot cancel: Insufficient stock to reverse. ` +
          `Need ${transaction.quantity} at ${(transaction.to_location_id as any).location_code}`,
      );
    }

    // ตรวจสอบว่าถูกใช้ไปแล้วหรือไม่
    const hasConsumption = await this.checkRelatedConsumption(
      transaction._id.toString(),
      (transaction.material_id as any)._id.toString(),
      (transaction.to_location_id as any)._id.toString(),
    );

    if (hasConsumption) {
      throw new ConflictException('Cannot cancel: Material has been consumed');
    }

    return transaction;
  }

  private async validateCancellableTransfer(
    transaction: MaterialTransaction,
  ): Promise<MaterialTransaction> {
    // ตรวจสอบที่ปลายทาง (to_location)
    const hasStock = await this.materialService.checkStockAvailability(
      (transaction.material_id as any).material_number,
      (transaction.to_location_id as any).location_code,
      transaction.quantity,
    );

    if (!hasStock) {
      throw new BadRequestException(
        'Cannot cancel transfer: Stock at destination has been used',
      );
    }

    return transaction;
  }

  private async validateCancellableConsume(
    transaction: MaterialTransaction,
  ): Promise<MaterialTransaction> {
    // ตรวจสอบว่า production record ที่เกี่ยวข้องยังไม่ถูก sync ไป SAP
    if (transaction.production_order_id) {
      const hasSync = await this.checkProductionSync(
        transaction.production_order_id.toString(),
      );

      if (hasSync) {
        throw new ConflictException(
          'Cannot cancel: Production data has been synced to SAP',
        );
      }
    }

    return transaction;
  }

  private async checkProductionSync(orderId: string): Promise<boolean> {
    // TODO: ตรวจสอบจาก production_records
    // ว่ามี record ที่ is_synced_to_sap = true หรือไม่
    return false;
  }

  private async createCancellationTransaction(
    original: MaterialTransaction,
    userId: string,
    reason: string,
  ): Promise<MaterialTransaction> {
    const transactionDate = moment().tz('Asia/Bangkok').toDate();
    let cancellationTx: MaterialTransaction;

    if (original.transaction_type === 'receive') {
      // ย้อนกลับ: ลบสต็อกที่รับเข้า
      await this.materialService.removeStockFromLocation(
        (original.material_id as any).material_number,
        (original.to_location_id as any).location_code,
        original.quantity,
        (original.to_position_id as any)?.position_code,
        original.lot_number,
      );

      const created = await this.transactionModel.create({
        transaction_type: 'cancellation',
        material_id: original.material_id,
        quantity: -original.quantity,
        to_location_id: original.to_location_id,
        to_position_id: original.to_position_id,
        cancelled_transaction_id: original._id,
        cancellation_reason: reason,
        user_id: toObjectId(userId),
        reference_doc: `CANCEL-${original._id}`,
        lot_number: original.lot_number,
        transaction_date: transactionDate,
      });
      cancellationTx = created; // ← access index
    } else if (original.transaction_type === 'transfer') {
      // ย้อนกลับ: ลบที่ปลายทาง, เพิ่มที่ต้นทาง
      await this.executeStockUpdate(
        (original.material_id as any).material_number,
        (original.to_location_id as any).location_code,
        (original.from_location_id as any).location_code,
        original.quantity,
        (original.to_position_id as any)?.position_code,
        (original.from_position_id as any)?.position_code,
        original.lot_number,
      );

      const created = await this.transactionModel.create({
        transaction_type: 'cancellation',
        material_id: original.material_id,
        quantity: original.quantity,
        from_location_id: original.to_location_id, // สลับกลับ
        to_location_id: original.from_location_id,
        from_position_id: original.to_position_id,
        to_position_id: original.from_position_id,
        cancelled_transaction_id: original._id,
        cancellation_reason: reason,
        user_id: toObjectId(userId),
        reference_doc: `CANCEL-${original._id}`,
        lot_number: original.lot_number,
        transaction_date: transactionDate,
      });
      cancellationTx = created; // ← access index
    } else if (original.transaction_type === 'consume') {
      // ย้อนกลับ: เพิ่มสต็อกกลับมา
      await this.materialService.addStockToLocation(
        (original.material_id as any).material_number,
        (original.from_location_id as any).location_code,
        original.quantity,
        (original.from_position_id as any)?.position_code,
        original.lot_number,
      );

      const created = await this.transactionModel.create({
        transaction_type: 'cancellation',
        material_id: original.material_id,
        quantity: original.quantity,
        to_location_id: original.from_location_id,
        to_position_id: original.from_position_id,
        cancelled_transaction_id: original._id,
        cancellation_reason: reason,
        user_id: toObjectId(userId),
        reference_doc: `CANCEL-${original._id}`,
        lot_number: original.lot_number,
        machine_id: original.machine_id,
        production_order_id: original.production_order_id,
        transaction_date: transactionDate,
      });
      cancellationTx = created; // ← access index
    } else {
      throw new BadRequestException(
        `Unsupported transaction type for cancellation: ${original.transaction_type}`,
      );
    }

    // Populate before return
    const populated = await this.transactionModel
      .findById(cancellationTx._id)
      .populate('material_id', 'material_number material_description')
      .populate('to_location_id', 'location_code location_name')
      .populate('from_location_id', 'location_code location_name')
      .populate('to_position_id', 'position_code')
      .populate('from_position_id', 'position_code')
      .exec();

    if (!populated) {
      throw new NotFoundException(
        'Cancellation transaction not found after creation',
      );
    }

    return populated;
  }

  private async checkRelatedConsumption(
    receiveTransactionId: string,
    materialId: string,
    locationId: string,
  ): Promise<boolean> {
    const receiveTransaction = await this.transactionModel
      .findById(receiveTransactionId)
      .exec();

    if (!receiveTransaction) {
      return false;
    }

    // หา consumption ที่เกิดขึ้นหลังจากรับเข้า
    const consumptionCount = await this.transactionModel
      .countDocuments({
        transaction_type: 'consume',
        material_id: toObjectId(materialId),
        from_location_id: toObjectId(locationId),
        transaction_date: { $gte: receiveTransaction.transaction_date },
        is_cancelled: { $ne: true }, // ← เพิ่มบรรทัดนี้ (ไม่นับ transaction ที่ถูกยกเลิก)
      })
      .exec();

    return consumptionCount > 0;
  }

  private validateQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    if (!Number.isInteger(quantity)) {
      throw new BadRequestException('Quantity must be an integer');
    }

    if (quantity > 1000000) {
      throw new BadRequestException(
        'Quantity exceeds maximum limit (1,000,000)',
      );
    }
  }

  private async getAvailableStockForError(
    materialNumber: string,
    locationCode: string,
    positionCode?: string,
    lotNumber?: string,
  ): Promise<number> {
    try {
      const material = await this.materialModel
        .findOne({ material_number: materialNumber })
        .populate('current_stock.location_id', 'location_code')
        .populate('current_stock.position_id', 'position_code')
        .exec();

      if (!material) return 0;

      const relevantStocks = material.current_stock.filter((stock: any) => {
        const locationMatch = stock.location_id?.location_code === locationCode;
        const positionMatch = positionCode
          ? stock.position_id?.position_code === positionCode
          : true;
        const lotMatch = lotNumber ? stock.lot_number === lotNumber : true;

        return locationMatch && positionMatch && lotMatch;
      });

      return relevantStocks.reduce(
        (sum: number, stock: any) => sum + (stock.stock_quantity || 0),
        0,
      );
    } catch {
      return 0;
    }
  }
}
