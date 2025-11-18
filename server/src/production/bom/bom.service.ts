import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SqlService } from 'src/shared/services/sql.service';
import { ResponseFormat } from 'src/shared/interface';
import moment = require('moment-timezone');
import { ProductionOrder } from 'src/schema/production-order.schema';
import { Material } from 'src/schema/material.schema';

@Injectable()
export class BOMService {
  constructor(
    @InjectModel(Material.name)
    private readonly materialModel: Model<Material>,
    @InjectModel(ProductionOrder.name)
    private readonly productionOrderModel: Model<ProductionOrder>,
    private readonly sqlService: SqlService,
  ) {}

  async syncBOMItems(): Promise<ResponseFormat<any>> {
    try {
      const query = `
        SELECT [Order_ID], [Mat_No], [Component]
        FROM [SNC-SAP].[dbo].[View_SAP_1620_Component]
        WHERE Component LIKE '19%' AND Unit_ReqQty = 'KG'
        ORDER BY Component
      `;

      const sqlData = await this.sqlService.query(query);
      const groupedData = this.groupBOMData(sqlData);

      let createdCount = 0;
      let updatedCount = 0;

      // Loop ผ่าน Material (เม็ดพลาสติก)
      for (const [materialNumber, usageInfo] of Object.entries(groupedData)) {
        let material = await this.materialModel.findOne({
          material_number: materialNumber,
        });

        if (!material) {
          // สร้าง material ใหม่
          material = await this.materialModel.create({
            material_number: materialNumber,
            unit_of_measurement: 'KG',
            default_usage: usageInfo.defaultUsage,
            usage_by_orders: usageInfo.orderUsages,
            current_stock: [],
          });
          createdCount++;
        } else {
          // ✅ Merge used_in_products
          const existingProducts =
            material.default_usage?.used_in_products || [];
          const newProducts = usageInfo.defaultUsage.used_in_products;

          material.default_usage = {
            used_in_products: [
              ...new Set([...existingProducts, ...newProducts]),
            ],
            last_updated: new Date(),
            is_active: true,
          };

          // แทนที่ usage_by_orders
          material.usage_by_orders = usageInfo.orderUsages;

          await material.save();
          updatedCount++;
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

  private groupBOMData(sqlData: any[]): Record<string, any> {
    const grouped: Record<string, any> = {};

    for (const item of sqlData) {
      const materialNumber = item.Component; // เม็ดพลาสติก (19xxxxxxx)
      const fgMaterialNumber = item.Mat_No; // สินค้า FG
      const orderId = item.Order_ID;

      if (!grouped[materialNumber]) {
        grouped[materialNumber] = {
          defaultUsage: null,
          orderUsages: [],
          allFGProducts: new Set<string>(),
        };
      }

      // เก็บว่าเม็ดนี้ถูกใช้ในสินค้า FG อะไรบ้าง
      grouped[materialNumber].allFGProducts.add(fgMaterialNumber);

      // ถ้ามี order_id ให้เก็บแยกตาม order
      if (orderId && orderId !== '' && orderId !== null) {
        const existingOrderUsage = grouped[materialNumber].orderUsages.find(
          (o: any) => o.order_id === orderId,
        );

        if (existingOrderUsage) {
          if (!existingOrderUsage.used_in_products.includes(fgMaterialNumber)) {
            existingOrderUsage.used_in_products.push(fgMaterialNumber);
          }
        } else {
          grouped[materialNumber].orderUsages.push({
            order_id: orderId,
            used_in_products: [fgMaterialNumber],
            log_date: new Date(),
            is_active: true,
          });
        }
      }
    }

    // สร้าง default usage
    for (const materialNumber in grouped) {
      const data = grouped[materialNumber];

      if (data.allFGProducts.size > 0) {
        data.defaultUsage = {
          used_in_products: Array.from(data.allFGProducts),
          last_updated: new Date(),
          is_active: true,
        };
      }

      delete data.allFGProducts;
    }

    return grouped;
  }

  // หาว่าเม็ดนี้ถูกใช้ในสินค้าอะไรบ้าง
  async getMaterialUsage(
    materialNumber: string, // เม็ดพลาสติก
    orderId?: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const material = await this.materialModel.findOne({
        material_number: materialNumber,
      });

      if (!material) {
        return {
          status: 'error',
          message: 'Material not found',
          data: [],
        };
      }

      let usageData = null;
      let source = 'not_found';

      // 1. หาด้วย order_id
      if (orderId) {
        usageData = material.usage_by_orders.find(
          (u) => u.order_id === orderId && u.is_active,
        );
        if (usageData) source = 'order_specific';
      }

      // 2. ใช้ default usage
      if (!usageData && material.default_usage?.is_active) {
        usageData = material.default_usage;
        source = 'default';
      }

      // 3. ใช้ usage ล่าสุด
      if (!usageData && material.usage_by_orders.length > 0) {
        usageData = material.usage_by_orders
          .filter((u) => u.is_active)
          .sort(
            (a, b) =>
              (b.log_date?.getTime() || 0) - (a.log_date?.getTime() || 0),
          )[0];
        if (usageData) source = 'latest_order';
      }

      if (!usageData) {
        return {
          status: 'success',
          message: 'No usage data found',
          data: [],
        };
      }

      return {
        status: 'success',
        message: `Material usage retrieved (${source})`,
        data: [
          {
            material_number: materialNumber,
            used_in_products: usageData.used_in_products,
            source: source,
            order_id: usageData.order_id || null,
          },
        ],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to get material usage: ' + (error as Error).message,
        data: [],
      };
    }
  }

  // หาว่าสินค้า FG นี้ใช้เม็ดอะไรบ้าง (Reverse lookup)
  async getRequiredMaterialsForProduct(
    fgMaterialNumber: string, // สินค้า FG
    orderId?: string,
  ): Promise<ResponseFormat<any>> {
    try {
      let materials = [];
      let source = 'not_found';

      // 1. ถ้ามี orderId ให้หาจาก order เท่านั้น
      if (orderId) {
        materials = await this.materialModel
          .find({
            usage_by_orders: {
              $elemMatch: {
                order_id: orderId,
                used_in_products: fgMaterialNumber,
                is_active: true,
              },
            },
          })
          .exec();

        if (materials.length > 0) {
          source = 'order_specific';
        }
      }

      // 2. ถ้าไม่มี orderId หรือหาจาก order ไม่เจอ
      // ให้หาจาก default_usage
      if (materials.length === 0) {
        materials = await this.materialModel
          .find({
            'default_usage.used_in_products': fgMaterialNumber,
            'default_usage.is_active': true,
          })
          .exec();

        if (materials.length > 0) {
          source = 'default_usage';
        }
      }

      // 3. ถ้ายังไม่เจอ return error
      if (materials.length === 0) {
        return {
          status: 'error',
          message: orderId
            ? `No materials found for product ${fgMaterialNumber} in order ${orderId}`
            : `No materials found for product ${fgMaterialNumber}`,
          data: [],
        };
      }

      const requiredMaterials = materials.map((mat) => ({
        material_number: mat.material_number,
        material_description: mat.material_description,
        available_stock: mat.current_stock.reduce(
          (sum, stock) => sum + stock.stock_quantity,
          0,
        ),
        unit: mat.unit_of_measurement,
      }));

      return {
        status: 'success',
        message: `Required materials retrieved from ${source}`,
        data: requiredMaterials,
      };
    } catch (error) {
      return {
        status: 'error',
        message:
          'Failed to get required materials: ' + (error as Error).message,
        data: [],
      };
    }
  }

  // เช็คว่าเม็ดพลาสติกมีพอสำหรับ Production Order หรือไม่
  async checkMaterialAvailabilityForOrder(
    orderId: string,
  ): Promise<ResponseFormat<any>> {
    try {
      const order = await this.productionOrderModel.findOne({
        order_id: orderId,
      });

      if (!order) {
        return {
          status: 'error',
          message: 'Production order not found',
          data: [],
        };
      }

      const materialsResult = await this.getRequiredMaterialsForProduct(
        order.material_number,
        orderId,
      );

      if (materialsResult.status === 'error') {
        return materialsResult;
      }

      const availabilityStatus = materialsResult.data.map((mat) => ({
        ...mat,
        is_sufficient: mat.available_stock > 0,
      }));

      const allSufficient = availabilityStatus.every((m) => m.is_sufficient);

      return {
        status: 'success',
        message: allSufficient
          ? 'All materials are available'
          : 'Some materials are insufficient',
        data: availabilityStatus,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to check availability: ' + (error as Error).message,
        data: [],
      };
    }
  }
}
