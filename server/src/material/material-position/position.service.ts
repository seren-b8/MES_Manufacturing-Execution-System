import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MaterialLocation } from 'src/schema/material-location.schema';
import { MaterialPosition } from 'src/schema/material-position.schema';
import { Material } from 'src/schema/material.schema';
import { ResponseFormat } from 'src/shared/interface';

@Injectable()
export class PositionService {
  constructor(
    @InjectModel(MaterialPosition.name)
    private positionModel: Model<MaterialPosition>,
    @InjectModel(MaterialLocation.name)
    private locationModel: Model<MaterialLocation>,
    @InjectModel(Material.name)
    private materialModel: Model<Material>,
  ) {}

  // ===== Query Methods =====

  async findAll(
    locationCode?: string,
  ): Promise<ResponseFormat<MaterialPosition>> {
    try {
      const pipeline: any[] = [];

      // 1. Early filtering - ทำให้เร็วที่สุดโดยกรองข้อมูลก่อน
      if (locationCode) {
        const location = await this.locationModel
          .findOne({ location_code: locationCode })
          .select('_id')
          .lean()
          .exec();

        if (!location) {
          throw new NotFoundException(`Location ${locationCode} not found`);
        }

        pipeline.push({
          $match: { location_id: location._id },
        });
      }

      // 2. Lookup location (เฉพาะ field ที่ต้องการ)
      pipeline.push({
        $lookup: {
          from: 'material_location',
          localField: 'location_id',
          foreignField: '_id',
          as: 'location',
          pipeline: [
            {
              $project: {
                location_name: 1,
                location_code: 1,
                location_type: 1,
              },
            },
          ],
        },
      });

      // 3. Lookup materials (optimized subpipeline)
      pipeline.push({
        $lookup: {
          from: 'material',
          let: { posId: '$_id' },
          pipeline: [
            // Match เฉพาะ material ที่มี stock ใน position นี้
            {
              $match: {
                $expr: {
                  $in: ['$$posId', '$current_stock.position_id'],
                },
              },
            },
            // Unwind และ filter ใน 1 step
            { $unwind: '$current_stock' },
            {
              $match: {
                $expr: { $eq: ['$$posId', '$current_stock.position_id'] },
              },
            },
            // Project เฉพาะข้อมูลที่ต้องการ
            {
              $project: {
                material_number: 1,
                material_description: 1,
                stock_quantity: '$current_stock.stock_quantity',
                lot_number: '$current_stock.lot_number',
              },
            },
          ],
          as: 'materials',
        },
      });

      // 4. Reshape output
      pipeline.push({
        $project: {
          location_id: { $arrayElemAt: ['$location', 0] },
          position_code: 1,
          shelf_code: 1,
          row: 1,
          column: 1,
          is_occupied: 1,
          materials: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      });

      // 5. Sort
      pipeline.push({ $sort: { position_code: 1 } });

      const positions = await this.positionModel
        .aggregate(pipeline)
        .allowDiskUse(true) // For large datasets
        .exec();

      return {
        status: 'success',
        message: `Found ${positions.length} positions`,
        data: positions as any,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException({
        status: 'error',
        message: `Failed to fetch positions: ${(error as Error).message}`,
        data: [],
      });
    }
  }
}
