// master-parts.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { MasterPart } from 'src/schema/master_parts.schema';
import {
  CreateMasterPartDto,
  UpdateMasterPartDto,
} from '../dto/master-parts.dto';
import axios from 'axios';
import { Type } from 'class-transformer';
import * as _ from 'lodash';
import path from 'path';
import { FileClientService } from 'src/shared/services/file-client/file-client.service';

@Injectable()
export class MasterPartsService {
  constructor(
    @InjectModel(MasterPart.name)
    private readonly masterPartModel: Model<MasterPart>,
    private readonly fileClientService: FileClientService,
  ) {}

  /**
   * สร้างชื่อไฟล์ใหม่ที่ไม่ซ้ำกัน
   * @param originalFilename ชื่อไฟล์ต้นฉบับ
   * @param machineNumber หมายเลขเครื่องจักร
   * @returns ชื่อไฟล์ใหม่
   */
  // ควรจะเป็นประมาณนี้
  // ควรนำไปแทนที่ฟังก์ชันเดิมทั้งหมด
  private generateUniqueFilename(
    originalFilename: string,
    materialNumber: string,
  ): string {
    try {
      // ตรวจสอบว่ามี path module หรือไม่
      const nodePath = require('path');

      // ตรวจสอบและจัดการกับค่า null/undefined
      if (!originalFilename) {
        return `${materialNumber || 'part'}_image_${Date.now()}.jpg`;
      }

      // ดึงนามสกุลไฟล์
      const ext = nodePath.extname(originalFilename) || '.jpg';

      // สร้างชื่อไฟล์ใหม่
      return `${materialNumber || 'part'}_image_${Date.now()}${ext}`;
    } catch (error) {
      // หากเกิดข้อผิดพลาด ให้ใช้ชื่อพื้นฐาน
      console.error('Error in generateUniqueFilename:', error);
      return `part_image_${Date.now()}.jpg`;
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
      console.log('Original request data:', createDto);

      // สร้าง object ใหม่เพื่อใช้ในการบันทึกข้อมูล โดยเลือกเฉพาะฟิลด์ที่ต้องการ
      const partData = {
        material_number: createDto.material_number,
        material_description: createDto.material_description,
        part_name: createDto.part_name,
        weight:
          typeof createDto.weight === 'string'
            ? parseFloat(createDto.weight)
            : createDto.weight,
        part_model: createDto.part_model,
        image_url: '',
      };

      // ตรวจสอบการซ้ำกัน
      const exists = await this.masterPartModel.findOne({
        material_number: partData.material_number,
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

      // จัดการกับไฟล์ที่อัพโหลด
      if (file) {
        try {
          const imagePath = 'mes/b8/master-parts';

          const newFilename = this.generateUniqueFilename(
            file.originalname,
            partData.material_number,
          );

          console.log('New filename:', newFilename);

          const response = await this.fileClientService.uploadFile(
            file,
            imagePath,
            newFilename,
          );

          console.log('File upload response:', response);

          if (
            response &&
            response.status === 'success' &&
            response.data &&
            response.data.length > 0
          ) {
            // เพิ่ม image_url ที่ได้จากการอัพโหลดไฟล์
            partData.image_url = response.data[0].url;
            console.log('Set image_url to:', partData.image_url);
          }
        } catch (fileError) {
          console.error('File upload error:', fileError);
        }
      }

      console.log('Final part data to save:', partData);
      const newPart = await this.masterPartModel.create(partData);

      return {
        status: 'success',
        message: 'Created part successfully',
        data: [newPart],
      };
    } catch (error) {
      console.error('Create part error:', error);

      if (error instanceof HttpException) throw error;

      throw new HttpException(
        {
          status: 'error',
          message: (error as Error).message || 'Failed to create part',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async update(
    updateDto: UpdateMasterPartDto,
    file?: Express.Multer.File,
  ): Promise<ResponseFormat<MasterPart>> {
    try {
      // ค้นหา part ด้วย material_number
      const part = await this.masterPartModel.findOne({
        material_number: updateDto.material_number,
      });

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

      // ถ้ามีการอัพโหลดไฟล์ใหม่
      if (file) {
        const imagePath = 'mes/b8/master-parts';

        // สร้างชื่อไฟล์ใหม่
        const newFilename = this.generateUniqueFilename(
          file.originalname,
          updateDto.material_number,
        );

        // อัพโหลดไฟล์ไปยัง file microservice
        const response = await this.fileClientService.uploadFile(
          file,
          imagePath,
          newFilename,
        );

        if (response.status === 'success') {
          // อัพเดต URL ของรูปภาพใน updateDto
          const fileUrl = response.data[0].url;
          updateDto.image_url = fileUrl;
        }
      }

      // อัปเดตข้อมูล
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
