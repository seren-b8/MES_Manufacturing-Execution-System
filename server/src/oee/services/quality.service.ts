import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProcessedMachineData, TimeFrame } from 'src/shared/interface/oee';
import { ProductionRecord } from 'src/schema/production-record.schema';
import { AssignOrder } from 'src/schema/assign-order.schema';

@Injectable()
export class QualityService {
  constructor(
    @InjectModel(ProductionRecord.name)
    private productionRecordModel: Model<ProductionRecord>,
    @InjectModel(AssignOrder.name)
    private assignOrderModel: Model<AssignOrder>,
  ) {}

  async calculate(timeframe: TimeFrame): Promise<any> {
    try {
      const qualityData = await this.getMultiMachineQualityData(
        timeframe.machine_numbers,
        timeframe,
      );

      return this.processMachineData(qualityData.orderSummary);
      // return this.calculateFactoryTotal(qualityData.orderSummary);
    } catch (error) {
      console.error('Error calculating quality:', error);
      return 0;
    }
  }

  async getMultiMachineQualityData(
    machineNumbers: string[], // เปลี่ยนจาก string เป็น array
    timeFrame: TimeFrame,
  ): Promise<{
    orderSummary?: Array<{
      assignOrderId: string;
      machineNumber: string;
      goodPieces: number;
      notGoodPieces: number;
      totalPieces: number;
      quality: number;
    }>;
  }> {
    try {
      // ดึง production records ในช่วงเวลาที่กำหนดก่อน
      const productionRecords = await this.productionRecordModel.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(timeFrame.start_time),
              $lte: new Date(timeFrame.end_time),
            },
            confirmation_status: { $ne: 'rejected' },
          },
        },
        {
          $lookup: {
            from: 'assign_order',
            localField: 'assign_order_id',
            foreignField: '_id',
            as: 'assign_order',
          },
        },
        {
          $unwind: '$assign_order',
        },
        ...(machineNumbers.length > 0
          ? [
              {
                $match: {
                  'assign_order.machine_number': { $in: machineNumbers },
                },
              },
            ]
          : []),
        {
          $group: {
            _id: {
              machine_number: '$assign_order.machine_number', // เพิ่มจุดนี้
              assign_order_id: '$assign_order_id',
              is_not_good: '$is_not_good',
            },
            totalQuantity: { $sum: '$quantity' },
            recordCount: { $sum: 1 },
            assign_order_info: { $first: '$assign_order' },
          },
        },
      ]);

      if (productionRecords.length === 0) {
        return {
          orderSummary: [],
        };
      }

      // จัดกลุ่มข้อมูลตาม assign_order และ good/ng
      const orderMap = new Map();
      let totalGoodPieces = 0;
      let totalNotGoodPieces = 0;

      productionRecords.forEach((record) => {
        const orderId = record._id.assign_order_id.toString();
        const machineNumber = record._id.machine_number; // เพิ่มบรรทัดนี้
        const isNotGood = record._id.is_not_good;
        const quantity = record.totalQuantity;

        if (!orderMap.has(orderId)) {
          orderMap.set(orderId, {
            assignOrderId: orderId,
            machineNumber: machineNumber, // เพิ่มบรรทัดนี้
            goodPieces: 0,
            notGoodPieces: 0,
            totalPieces: 0,
            orderInfo: record.assign_order_info,
          });
        }

        const orderData = orderMap.get(orderId);

        if (isNotGood) {
          orderData.notGoodPieces += quantity;
          totalNotGoodPieces += quantity;
        } else {
          orderData.goodPieces += quantity;
          totalGoodPieces += quantity;
        }

        orderData.totalPieces = orderData.goodPieces + orderData.notGoodPieces;
      });

      // แปลง Map เป็น Array สำหรับ response
      const orderSummary = Array.from(orderMap.values()).map((order) => ({
        assignOrderId: order.assignOrderId,
        machineNumber: order.machineNumber,
        goodPieces: order.goodPieces,
        notGoodPieces: order.notGoodPieces,
        totalPieces: order.totalPieces,
        quality:
          Math.round(
            (order.totalPieces > 0
              ? (order.goodPieces / order.totalPieces) * 100
              : 0) * 100,
          ) / 100,
      }));

      return {
        orderSummary,
      };
    } catch (error) {
      console.error('Error getting quality data from records:', error);
      return {
        orderSummary: [],
      };
    }
  }

  private processMachineData(orderSummary: any[]): ProcessedMachineData[] {
    const machineGroups = orderSummary.reduce((acc, item) => {
      const machineNumber = item.machineNumber;
      if (!acc[machineNumber]) {
        acc[machineNumber] = [];
      }
      acc[machineNumber].push(item);
      return acc;
    }, {});

    return Object.keys(machineGroups).map((machineNumber) => {
      const orders = machineGroups[machineNumber];

      // คำนวณยอดรวม
      const totalGoodPieces = orders.reduce(
        (sum, order) => sum + order.goodPieces,
        0,
      );
      const totalNotGoodPieces = orders.reduce(
        (sum, order) => sum + order.notGoodPieces,
        0,
      );
      const totalPieces = totalGoodPieces + totalNotGoodPieces;
      const quality =
        totalPieces > 0
          ? Math.round((totalGoodPieces / totalPieces) * 100 * 100) / 100
          : 0;

      const assignOrderIds = orders.map((order) => order.assignOrderId);

      return {
        machineNumber,
        quality: quality,
        goodPieces: totalGoodPieces, // ✅ เพิ่ม
        notGoodPieces: totalNotGoodPieces, // ✅ เพิ่ม
        totalPieces: totalPieces, // ✅ เพิ่ม
        assignOrderIds,
      };
    });
  }

  private calculateFactoryQuality(orderSummary: any[]): any {
    // รวมข้อมูลทั้งโรงงาน
    const factoryTotals = orderSummary.reduce(
      (acc, order) => {
        acc.totalGoodPieces += order.goodPieces;
        acc.totalNotGoodPieces += order.notGoodPieces;
        acc.totalPieces += order.totalPieces;
        acc.assignOrderIds.push(order.assignOrderId);
        return acc;
      },
      {
        totalGoodPieces: 0,
        totalNotGoodPieces: 0,
        totalPieces: 0,
        assignOrderIds: [],
      },
    );

    // คำนวณ Factory Quality
    const factoryQuality =
      factoryTotals.totalPieces > 0
        ? Math.round(
            (factoryTotals.totalGoodPieces / factoryTotals.totalPieces) *
              100 *
              100,
          ) / 100
        : 0;

    // Remove duplicates from assignOrderIds
    const uniqueAssignOrderIds = [...new Set(factoryTotals.assignOrderIds)];

    return {
      machineNumber: 'ALL',
      quality: factoryQuality,
      totalGoodPieces: factoryTotals.totalGoodPieces,
      totalNotGoodPieces: factoryTotals.totalNotGoodPieces,
      totalPieces: factoryTotals.totalPieces,
      assignOrderIds: uniqueAssignOrderIds,
    };
  }
}
