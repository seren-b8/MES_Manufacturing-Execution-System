// master-parts.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { MasterPart } from 'src/shared/modules/schema/master_parts.schema';
import {
  CreateMasterPartDto,
  UpdateMasterPartDto,
} from '../dto/master-parts.dto';

@Injectable()
export class MasterPartsService {
  constructor(
    @InjectModel(MasterPart.name)
    private readonly masterPartModel: Model<MasterPart>,
  ) {}

  async findAll(query: any = {}): Promise<ResponseFormat<MasterPart>> {
    try {
      const parts = await this.masterPartModel.find(query).lean();
      return {
        status: 'success',
        message: 'Retrieved parts successfully',
        data: parts,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve parts',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<ResponseFormat<MasterPart>> {
    try {
      const part = await this.masterPartModel.findById(id).lean();

      if (!part) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Part not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Retrieved part successfully',
        data: [part],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve part',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByMaterialNumber(
    materialNumber: string,
  ): Promise<ResponseFormat<MasterPart>> {
    try {
      const part = await this.masterPartModel
        .findOne({
          material_number: materialNumber,
        })
        .lean();

      if (!part) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Part not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Retrieved part successfully',
        data: [part],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve part',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async create(
    createDto: CreateMasterPartDto,
  ): Promise<ResponseFormat<MasterPart>> {
    try {
      // Check if material number already exists
      const exists = await this.masterPartModel.findOne({
        material_number: createDto.material_number,
      });

      if (exists) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Material number already exists',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const newPart = await this.masterPartModel.create(createDto);
      return {
        status: 'success',
        message: 'Created part successfully',
        data: [newPart],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to create part',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdateMasterPartDto,
  ): Promise<ResponseFormat<MasterPart>> {
    try {
      // Check if material number exists on another record if updating
      if (updateDto.material_number) {
        const exists = await this.masterPartModel.findOne({
          material_number: updateDto.material_number,
          _id: { $ne: id },
        });

        if (exists) {
          throw new HttpException(
            {
              status: 'error',
              message: 'Material number already exists',
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const updatedPart = await this.masterPartModel
        .findByIdAndUpdate(id, updateDto, { new: true })
        .lean();

      if (!updatedPart) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Part not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Updated part successfully',
        data: [updatedPart],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update part',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<ResponseFormat<MasterPart>> {
    try {
      const deletedPart = await this.masterPartModel
        .findByIdAndDelete(id)
        .lean();

      if (!deletedPart) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Part not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Deleted part successfully',
        data: [deletedPart],
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to delete part',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private splitPartNumberAndName(description: string): {
    partNumber: string;
    partName: string;
  } {
    const firstSpaceIndex = description.indexOf(' ');

    if (firstSpaceIndex === -1) {
      return {
        partNumber: description,
        partName: '',
      };
    }

    const partNumber = description.substring(0, firstSpaceIndex);
    const partName = description.substring(firstSpaceIndex + 1).trim();

    return { partNumber, partName };
  }

  async updateAllPartNumberAndName(): Promise<{
    totalCount: number;
    updatedCount: number;
    errors: Array<{ materialNumber: string; error: string }>;
  }> {
    // ดึงข้อมูลทั้งหมดที่มี material_description
    const masterParts = await this.masterPartModel.find({
      material_description: { $exists: true, $ne: null },
    });

    let updatedCount = 0;
    const errors: Array<{ materialNumber: string; error: string }> = [];

    // วนลูปอัพเดททีละรายการ
    for (const masterPart of masterParts) {
      try {
        if (!masterPart.material_description) {
          throw new Error('ไม่มี material_description');
        }

        // แยก part_number และ part_name
        const { partNumber, partName } = this.splitPartNumberAndName(
          masterPart.material_description,
        );

        // อัพเดทข้อมูล
        masterPart.part_number = partNumber;
        masterPart.part_name = partName;
        await masterPart.save();

        updatedCount++;
      } catch (error) {
        // เก็บ error กรณีมีปัญหา
        errors.push({
          materialNumber: masterPart.material_number,
          error: (error as Error).message,
        });
      }
    }

    // ส่งผลลัพธ์การอัพเดท
    return {
      totalCount: masterParts.length,
      updatedCount,
      errors,
    };
  }
}
