// src/material-receipt/material-receipt.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MaterialReceiptItem,
  MaterialReceiptItemDocument,
} from 'src/schema/material-receipt-items';
import {
  MaterialReceipt,
  MaterialReceiptDocument,
} from 'src/schema/material-receipts.schema';
import {
  MaterialTransaction,
  MaterialTransactionDocument,
} from 'src/schema/material-transaction.schema';
import { Material, MaterialDocument } from 'src/schema/material.schema';
import { ResponseFormat } from 'src/shared/interface';
import { SqlService } from 'src/shared/services/sql.service';
import moment = require('moment-timezone');
import { TransactionService } from '../material-transaction/transaction.service';
import { MaterialService } from '../material.service';
import { LocationService } from '../material-location/location.service';
import { PositionService } from '../material-position/position.service';

@Injectable()
export class MaterialReceiptService {
  constructor(
    @InjectModel(MaterialReceipt.name)
    private readonly materialReceiptModel: Model<MaterialReceiptDocument>,
    @InjectModel(MaterialReceiptItem.name)
    private readonly materialReceiptItemModel: Model<MaterialReceiptItemDocument>,
    @InjectModel(Material.name)
    private readonly materialModel: Model<MaterialDocument>,
    @InjectModel(MaterialTransaction.name)
    private readonly materialTransactionModel: Model<MaterialTransactionDocument>,
    private readonly sqlService: SqlService,
    private readonly materialTransactionService: TransactionService, // ⭐ เพิ่ม
    private readonly materialService: MaterialService, // ⭐ เพิ่ม
    private readonly locationService: LocationService, // ⭐ เพิ่ม
    private readonly positionService: PositionService, // ⭐ เพิ่ม
  ) {}

  // ==================== SYNC FROM SAP ====================

  async syncMaterialReceiptsFromSQL(
    startDate?: string,
    endDate?: string,
  ): Promise<ResponseFormat<any>> {
    try {
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = `AND [Recived_Date] BETWEEN '${startDate}' AND '${endDate}'`;
      } else if (startDate) {
        dateFilter = `AND [Recived_Date] >= '${startDate}'`;
      }

      const query = await this.sqlService.query(`
      SELECT 
        [Plant],
        [Material],
        MAX([Short_Text]) as Short_Text,
        [Movement_type],
        [Recived_Date],
        SUM(CAST([Recived_Qty] AS DECIMAL(18, 3))) as Total_Qty,
        [Unit],
        MAX([Material_Group_Desc]) as Material_Group_Desc,
        MAX([Material_Grp_Desc2]) as Material_Grp_Desc2,
        COUNT(*) as Record_Count
      FROM [SNC-SAP].[dbo].[View_Report_PO_Received_1620]
      WHERE [Unit] = 'kg' 
        AND ([Material] LIKE '19%' OR [Material] LIKE '393%')
        AND [Recived_Qty] IS NOT NULL
        AND TRY_CAST([Recived_Qty] AS DECIMAL(18, 3)) IS NOT NULL
        ${dateFilter}
      GROUP BY 
        [Plant],
        [Material],
        [Movement_type],
        [Recived_Date],
        [Unit]
      ORDER BY [Recived_Date] DESC, [Material]
    `);

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of query) {
        try {
          const existing = await this.materialReceiptModel.findOne({
            plant: row.Plant,
            material_number: row.Material,
            movement_type: row.Movement_type,
            received_date: new Date(row.Recived_Date),
          });

          const totalQty =
            typeof row.Total_Qty === 'string'
              ? parseFloat(row.Total_Qty)
              : row.Total_Qty;

          if (existing) {
            let hasChanges = false;

            // ⭐ เช็คการเปลี่ยนแปลงจำนวน
            if (existing.total_received_quantity !== totalQty) {
              // คำนวณส่วนต่างของจำนวนที่เปลี่ยน
              const qtyDifference = totalQty - existing.total_received_quantity;

              existing.total_received_quantity = totalQty;

              // ⭐ ปรับ remaining_quantity ตามส่วนต่าง
              // remaining = total - processed
              // ถ้า total เพิ่มขึ้น -> remaining เพิ่มขึ้น
              // ถ้า total ลดลง -> remaining ลดลง
              existing.remaining_quantity =
                totalQty - existing.processed_quantity;

              // ⭐ ตรวจสอบสถานะ
              if (
                existing.remaining_quantity <= 0 &&
                existing.processed_quantity > 0
              ) {
                existing.receipt_status = 'completed';
              } else if (
                existing.processed_quantity > 0 &&
                existing.remaining_quantity > 0
              ) {
                existing.receipt_status = 'partial';
              } else if (existing.processed_quantity === 0) {
                existing.receipt_status = 'pending';
              }

              hasChanges = true;
            }

            // ⭐ เช็คการเปลี่ยนแปลงข้อมูล metadata
            if (existing.short_text !== row.Short_Text) {
              existing.short_text = row.Short_Text;
              hasChanges = true;
            }

            if (existing.material_group_desc !== row.Material_Group_Desc) {
              existing.material_group_desc = row.Material_Group_Desc;
              hasChanges = true;
            }

            if (existing.material_group_desc2 !== row.Material_Grp_Desc2) {
              existing.material_group_desc2 = row.Material_Grp_Desc2;
              hasChanges = true;
            }

            if (existing.unit !== row.Unit) {
              existing.unit = row.Unit;
              hasChanges = true;
            }

            // ⭐ บันทึกถ้ามีการเปลี่ยนแปลง
            if (hasChanges) {
              await existing.save();
              updated++;
            } else {
              skipped++;
            }
          } else {
            // ⭐ สร้างใหม่
            await this.materialReceiptModel.create({
              plant: row.Plant,
              material_number: row.Material,
              short_text: row.Short_Text,
              movement_type: row.Movement_type,
              received_date: new Date(row.Recived_Date),
              total_received_quantity: totalQty,
              processed_quantity: 0,
              remaining_quantity: totalQty,
              unit: row.Unit,
              material_group_desc: row.Material_Group_Desc,
              material_group_desc2: row.Material_Grp_Desc2,
              receipt_status: 'pending',
              sync_status: 'pending',
            });
            created++;
          }
        } catch (error) {
          console.error(
            `Error syncing receipt for material ${row.Material}:`,
            (error as Error).message,
          );
          skipped++;
        }
      }

      return {
        status: 'success',
        message: `Synced ${query.length} unique receipts (aggregated from SQL)`,
        data: [
          {
            unique_receipts: query.length,
            created,
            updated,
            skipped,
            details: {
              note:
                updated > 0
                  ? 'Some receipts were updated with new quantities or metadata'
                  : 'No changes detected',
            },
          },
        ],
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to sync receipts: ${(error as Error).message}`,
      );
    }
  }

  async syncTodayReceipts(): Promise<ResponseFormat<any>> {
    const today = moment().tz('Asia/Bangkok').format('YYYY-MM-DD');
    return this.syncMaterialReceiptsFromSQL(today, today);
  }

  async syncRecentReceipts(days: number = 7): Promise<ResponseFormat<any>> {
    const endDate = moment().tz('Asia/Bangkok');
    const startDate = moment().tz('Asia/Bangkok').subtract(days, 'days');

    return this.syncMaterialReceiptsFromSQL(
      startDate.format('YYYY-MM-DD'),
      endDate.format('YYYY-MM-DD'),
    );
  }

  // ==================== CRUD OPERATIONS ====================

  async findAll(filters?: {
    receipt_status?: string;
    material_number?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ResponseFormat<MaterialReceipt>> {
    try {
      const query: any = {};

      if (filters?.receipt_status) {
        query.receipt_status = filters.receipt_status;
      }

      if (filters?.material_number) {
        query.material_number = filters.material_number;
      }

      if (filters?.start_date && filters?.end_date) {
        query.received_date = {
          $gte: new Date(filters.start_date),
          $lte: new Date(filters.end_date),
        };
      }

      const receipts = await this.materialReceiptModel
        .find(query)
        .sort({ received_date: -1 })
        .lean() // ⭐ ใช้ lean() เพื่อได้ plain object
        .exec();

      return {
        status: 'success',
        message: `Found ${receipts.length} receipts`,
        data: receipts,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch receipts: ${(error as Error).message}`,
      );
    }
  }

  async findById(id: string): Promise<ResponseFormat<MaterialReceipt>> {
    try {
      const receipt = await this.materialReceiptModel
        .findById(id)
        .populate('receipt_items')
        .exec();

      if (!receipt) {
        throw new NotFoundException(`Receipt with ID ${id} not found`);
      }

      return {
        status: 'success',
        message: 'Receipt retrieved successfully',
        data: [receipt],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        `Failed to fetch receipt: ${(error as Error).message}`,
      );
    }
  }

  async findPending(): Promise<ResponseFormat<MaterialReceipt>> {
    try {
      const receipts = await this.materialReceiptModel
        .find({
          receipt_status: { $in: ['pending', 'partial'] },
        })
        .sort({ received_date: -1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${receipts.length} pending receipts`,
        data: receipts,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch pending receipts: ${(error as Error).message}`,
      );
    }
  }

  // ==================== PROCESS RECEIPT ====================

  async processReceipt(
    receiptId: string,
    items: Array<{
      location_code: string; // ⭐ เปลี่ยนจาก location_id
      position_code?: string; // ⭐ เปลี่ยนจาก position_id
      quantity: number;
      lot_number?: string;
      remark?: string;
    }>,
    userId: string,
  ): Promise<ResponseFormat<MaterialReceiptItem>> {
    const receipt = await this.materialReceiptModel.findById(receiptId);

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${receiptId} not found`);
    }

    if (receipt.receipt_status === 'completed') {
      throw new BadRequestException('Receipt already completed');
    }

    if (receipt.receipt_status === 'cancelled') {
      throw new BadRequestException('Cannot process cancelled receipt');
    }

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    if (
      receipt.processed_quantity + totalQuantity >
      receipt.total_received_quantity
    ) {
      throw new BadRequestException(
        `Total quantity (${totalQuantity}) exceeds remaining quantity (${receipt.remaining_quantity})`,
      );
    }

    const receiptItems = [];
    const createdItemIds = [];

    try {
      const material = await this.materialService.validateMaterialExists(
        receipt.material_number,
      );

      for (const item of items) {
        // ⭐ Validate location by code (แทน ID)
        const location = await this.locationService.validateLocationExists(
          item.location_code, // ⭐ ใช้ code
        );

        let positionId = null;
        if (item.position_code) {
          // ⭐ Validate position by code
          const position = await this.positionService.validatePositionByCode(
            item.position_code, // ⭐ ใช้ code
            location._id.toString(),
          );
          positionId = position._id;
        }

        // Create receipt item (เก็บ ID ใน database)
        const receiptItem = await this.materialReceiptItemModel.create({
          material_receipt_id: receiptId,
          location_id: location._id, // เก็บ ObjectId ใน DB
          position_id: positionId, // เก็บ ObjectId ใน DB
          quantity: item.quantity,
          lot_number: item.lot_number,
          received_by: userId,
          remark: item.remark,
        });

        createdItemIds.push(receiptItem._id);

        // Create transaction (ส่ง code)
        const transactionResult =
          await this.materialTransactionService.receiveMaterial({
            material_number: receipt.material_number,
            quantity: item.quantity,
            to_location_code: item.location_code, // ⭐ ใช้ code
            to_position_code: item.position_code, // ⭐ ใช้ code
            lot_number: item.lot_number,
            reference_doc: receipt._id.toString(),
            user_id: userId,
            transaction_date: moment().tz('Asia/Bangkok').toDate(),
          });

        const transaction = transactionResult.data[0];
        receiptItem.material_transaction_id = transaction._id as Types.ObjectId;
        await receiptItem.save();

        receiptItems.push(receiptItem);
      }

      // Update receipt
      receipt.processed_quantity += totalQuantity;
      receipt.remaining_quantity =
        receipt.total_received_quantity - receipt.processed_quantity;

      if (receipt.remaining_quantity === 0) {
        receipt.receipt_status = 'completed';
        receipt.sync_status = 'processed';
        receipt.processed_at = moment().tz('Asia/Bangkok').toDate();
      } else {
        receipt.receipt_status = 'partial';
      }

      await receipt.save();

      return {
        status: 'success',
        message: `Processed ${receiptItems.length} items successfully`,
        data: receiptItems,
      };
    } catch (error) {
      // Rollback
      for (const itemId of createdItemIds) {
        await this.deleteReceiptItem(itemId.toString(), userId).catch((err) => {
          console.error(`Failed to rollback receipt item ${itemId}:`, err);
        });
      }

      throw new BadRequestException(
        `Failed to process receipt: ${(error as Error).message}`,
      );
    }
  }

  // ==================== RECEIPT ITEMS ====================

  async getReceiptItems(
    receiptId: string,
  ): Promise<ResponseFormat<MaterialReceiptItem>> {
    try {
      const items = await this.materialReceiptItemModel
        .find({ material_receipt_id: receiptId })
        .populate('location_id', 'location_name location_code')
        .populate('position_id', 'position_code')
        .populate('received_by', 'employee_id')
        .sort({ received_at: -1 })
        .exec();

      return {
        status: 'success',
        message: `Found ${items.length} receipt items`,
        data: items,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch receipt items: ${(error as Error).message}`,
      );
    }
  }

  async deleteReceiptItem(
    itemId: string,
    userId: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const item = await this.materialReceiptItemModel.findById(itemId);

      if (!item) {
        throw new NotFoundException(`Receipt item with ID ${itemId} not found`);
      }

      const receipt = await this.materialReceiptModel.findById(
        item.material_receipt_id,
      );

      if (!receipt) {
        throw new NotFoundException('Parent receipt not found');
      }

      // ⭐ Cancel transaction (จะ reverse stock อัตโนมัติใน createCancellationTransaction)
      if (item.material_transaction_id) {
        await this.materialTransactionService.cancelTransaction({
          transaction_id: item.material_transaction_id.toString(),
          cancellation_reason: `Receipt item ${itemId} deleted by user`,
          user_id: userId,
        });
      }

      // Update receipt quantities
      receipt.processed_quantity -= item.quantity;
      receipt.remaining_quantity += item.quantity;

      // ⭐ Update status based on remaining
      if (receipt.remaining_quantity === receipt.total_received_quantity) {
        receipt.receipt_status = 'pending';
      } else if (receipt.remaining_quantity > 0) {
        receipt.receipt_status = 'partial';
      }

      await receipt.save();
      // Delete item
      await item.deleteOne();

      return {
        status: 'success',
        message: 'Receipt item deleted and stock reversed successfully',
        data: [
          {
            deleted_item_id: itemId,
            reversed_quantity: item.quantity,
            updated_receipt_status: receipt.receipt_status,
          },
        ],
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        `Failed to delete receipt item: ${(error as Error).message}`,
      );
    }
  }

  // ==================== HELPER METHODS ====================

  async cancelReceipt(
    receiptId: string,
    reason: string,
  ): Promise<ResponseFormat<MaterialReceipt>> {
    try {
      const receipt = await this.materialReceiptModel.findById(receiptId);

      if (!receipt) {
        throw new NotFoundException(`Receipt with ID ${receiptId} not found`);
      }

      if (receipt.processed_quantity > 0) {
        throw new BadRequestException(
          'Cannot cancel receipt with processed items',
        );
      }

      receipt.receipt_status = 'cancelled';
      receipt.sync_status = 'failed';
      receipt.sync_error = reason;
      await receipt.save();

      return {
        status: 'success',
        message: 'Receipt cancelled successfully',
        data: [receipt],
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to cancel receipt: ${(error as Error).message}`,
      );
    }
  }
}
