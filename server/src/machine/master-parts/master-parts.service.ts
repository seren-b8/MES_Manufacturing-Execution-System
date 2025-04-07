// master-parts.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { MasterPart } from 'src/shared/modules/schema/master_parts.schema';
import {
  CreateMasterPartDto,
  UpdateMasterPartDto,
} from '../dto/master-parts.dto';
import axios from 'axios';
import { Type } from 'class-transformer';
import * as _ from 'lodash';

@Injectable()
export class MasterPartsService {
  constructor(
    @InjectModel(MasterPart.name)
    private readonly masterPartModel: Model<MasterPart>,
  ) {}

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

  // Helper method to handle image upload
  private async uploadImage(
    file: Express.Multer.File,
    materialNumber: string,
  ): Promise<string> {
    try {
      // Generate a unique filename using material number and timestamp
      const timestamp = new Date().getTime();
      const fileExtension = file.originalname.split('.').pop();
      const filename = `${materialNumber}_${timestamp}.${fileExtension}`;
      console.log('filename', filename);

      // Define the base server URL
      const baseServerUrl = process.env.IMAGE_SERVER_URL;

      // Create a FormData object for the file upload
      const formData = new FormData();

      // Convert Buffer to Blob
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('file', blob, filename);

      // Upload the file to your server
      await axios.post(`${baseServerUrl}upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Return the URL to access the image
      return `${baseServerUrl}${filename}`;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw new Error(`Image upload failed: ${(error as Error).message}`);
    }
  }

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
    file?: Express.Multer.File,
  ): Promise<ResponseFormat<MasterPart>> {
    try {
      // Check if material number already exists
      const exists = await this.masterPartModel.findOne({
        material_number: createDto.material_number,
      });

      console.log(createDto);

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

      if (file) {
        const imagePath = await this.uploadImage(
          file,
          createDto.material_number,
        );
        createDto.image_url = imagePath;
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
    updateDto: UpdateMasterPartDto,
  ): Promise<ResponseFormat<MasterPart>> {
    try {
      const part = await this.masterPartModel.findOne({
        material_number: updateDto.material_number,
      });

      console.log(part);

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

      // อัปเดตข้อมูล (ไม่จำเป็นต้องใช้ lean() ถ้าไม่มีความจำเป็น)
      const updatedPart = await this.masterPartModel.findOneAndUpdate(
        { material_number: updateDto.material_number },
        { $set: updateDto },
        { new: true, runValidators: true },
      );

      return {
        status: 'success',
        message: 'Updated part successfully',
        data: [updatedPart],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      console.error('Update part error:', error);

      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message || 'Failed to update part',
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

  async updateAllPartNumberAndName(): Promise<{
    totalCount: number;
    updatedCount: number;
    errors: Array<{ materialNumber: string; error: string }>;
  }> {
    // ดึงเฉพาะข้อมูลที่มี material_description แต่ยังไม่มี part_number หรือ part_name
    const masterParts = await this.masterPartModel.find({
      material_description: { $exists: true, $ne: null },
      $or: [
        { part_number: { $exists: false } },
        { part_number: null },
        { part_name: { $exists: false } },
        { part_name: null },
      ],
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
