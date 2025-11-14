import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SqlService } from 'src/shared/services/sql.service';
import { ResponseFormat } from 'src/shared/interface';
import moment = require('moment-timezone');
import { BOMItem } from 'src/schema/bom-items.schema';
import { ProductionOrder } from 'src/schema/production-order.schema';

@Injectable()
export class BOMService {
  constructor(
    @InjectModel(BOMItem.name)
    private readonly bomItemModel: Model<BOMItem>,

    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,

    private readonly sqlService: SqlService,
  ) {}

  // Sync BOM จาก SQL
  async syncBOMItems(): Promise<ResponseFormat<any>> {
    try {
      const query = `
        SELECT [Order_ID]
              ,[Mat_No]
              ,[MatDesc]
              ,[Component]
              ,[ComponentDesc]
              ,[ReqQty]
              ,[Unit_ReqQty]
              ,[BOMItem]
              ,[Reservation]
              ,[ItemNo]
              ,[Logdate]
        FROM [SNC-SAP].[dbo].[View_SAP_1620_Component]
        WHERE Component LIKE '19%' 
        AND Unit_ReqQty = 'KG'
        ORDER BY Mat_No
      `;

      const sqlData = await this.sqlService.query(query);

      let createdCount = 0;
      let updatedCount = 0;

      for (const item of sqlData) {
        const bomData = {
          order_id: item.Order_ID,
          parent_material_number: item.Mat_No,
          component_material_number: item.Component,
          component_description: item.ComponentDesc,
          reservation: item.Reservation,
          required_quantity: Number(item.ReqQty) || 0,
          unit: item.Unit_ReqQty,
          bom_item: item.BOMItem,
          item_number: item.ItemNo,
          log_date: item.Logdate
            ? moment(item.Logdate).tz('Asia/Bangkok').toDate()
            : null,
        };

        const existing = await this.bomItemModel.findOne({
          reservation: bomData.reservation,
          component_material_number: bomData.component_material_number,
        });

        if (existing) {
          await this.bomItemModel.updateOne(
            { _id: existing._id },
            { $set: bomData },
          );
          updatedCount++;
        } else {
          await this.bomItemModel.create(bomData);
          createdCount++;
        }
      }

      return {
        status: 'success',
        message: 'BOM items synced successfully',
        data: [
          {
            created: createdCount,
            updated: updatedCount,
            total: createdCount + updatedCount,
          },
        ],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to sync BOM items: ' + (error as Error).message,
        data: [],
      };
    }
  }

  // ดึง BOM ตาม parent material
  async getBOMByMaterial(
    materialNumber: string,
  ): Promise<ResponseFormat<BOMItem>> {
    try {
      const bomItems = await this.bomItemModel
        .find({
          parent_material_number: materialNumber,
        })
        .exec();

      return {
        status: 'success',
        message: `Found ${bomItems.length} BOM items`,
        data: bomItems,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to get BOM items: ' + (error as Error).message,
        data: [],
      };
    }
  }

  // คำนวณความต้องการวัตถุดิบสำหรับ order
  async calculateMaterialRequirement(
    materialNumber: string,
    targetQuantity: number,
  ): Promise<ResponseFormat<any>> {
    try {
      const bomItems = await this.bomItemModel
        .find({
          parent_material_number: materialNumber,
        })
        .exec();

      if (bomItems.length === 0) {
        return {
          status: 'success',
          message: 'No BOM items found for this material',
          data: [],
        };
      }

      const requirements = bomItems.map((bom) => ({
        component_material_number: bom.component_material_number,
        component_description: bom.component_description,
        required_per_unit: bom.required_quantity,
        total_required: bom.required_quantity * targetQuantity,
        unit: bom.unit,
      }));

      return {
        status: 'success',
        message: 'Material requirements calculated',
        data: requirements,
      };
    } catch (error) {
      return {
        status: 'error',
        message:
          'Failed to calculate requirements: ' + (error as Error).message,
        data: [],
      };
    }
  }

  async getBOMForOrder(orderId: string): Promise<ResponseFormat<any>> {
    try {
      // ต้อง inject ProductionOrderModel ด้วย
      const order = await this.productionOrderModel.findById(orderId);

      if (!order) {
        return {
          status: 'error',
          message: 'Production order not found',
          data: [],
        };
      }

      const result = await this.calculateMaterialRequirement(
        order.material_number,
        order.target_quantity,
      );

      return result;
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to get BOM for order: ' + (error as Error).message,
        data: [],
      };
    }
  }
}
