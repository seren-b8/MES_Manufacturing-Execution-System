import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { MasterCavity } from 'src/shared/modules/schema/master-cavity.schema';
import {
  CreateMasterCavityDto,
  UpdateMasterCavityDto,
} from '../dto/master-cavity.dto';
import { MasterPart } from 'src/shared/modules/schema/master_parts.schema';
import { Time } from 'mssql';
import { TimelineMachine } from 'src/shared/modules/schema/timeline-machine.schema';

@Injectable()
export class MachineCavityService {
  constructor(
    @InjectModel(MasterCavity.name)
    private readonly machineCavityModel: Model<MasterCavity>,
    @InjectModel(MasterPart.name) // เพิ่ม Part Model
    private readonly masterPartModel: Model<MasterPart>,
    @InjectModel(TimelineMachine.name)
    private readonly timelineMachineModel: Model<TimelineMachine>,
  ) {}

  async findAll(query: any = {}): Promise<ResponseFormat<MasterCavity>> {
    try {
      const cavities = await this.machineCavityModel.find(query).lean();
      return {
        status: 'success',
        message: 'Retrieved machine cavities successfully',
        data: cavities,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve machine cavities',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // async findOne(id: string): Promise<ResponseFormat<MasterCavity>> {
  //   try {
  //     const cavity = await this.machineCavityModel.findById(id).lean();

  //     if (!cavity) {
  //       throw new HttpException(
  //         {
  //           status: 'error',
  //           message: 'Machine cavity not found',
  //           data: [],
  //         },
  //         HttpStatus.NOT_FOUND,
  //       );
  //     }

  //     return {
  //       status: 'success',
  //       message: 'Retrieved machine cavity successfully',
  //       data: [cavity],
  //     };
  //   } catch (error) {
  //     if (error instanceof HttpException) {
  //       throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
  //     }
  //     throw new HttpException(
  //       {
  //         status: 'error',
  //         message: 'Failed to retrieve machine cavity ',
  //         data: [],
  //       },
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  async findByMaterialNumber(
    materialNumber: string,
  ): Promise<ResponseFormat<MasterCavity>> {
    try {
      const cavity = await this.machineCavityModel
        .findOne({
          'parts.material_number': materialNumber,
        })
        .lean();

      if (!cavity) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Cavity not found for this material',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Retrieved cavity successfully',
        data: [cavity],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve cavity',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async create(
    createDto: CreateMasterCavityDto,
  ): Promise<ResponseFormat<MasterCavity>> {
    try {
      // Validate unique material numbers within the request
      const materialNumbers = createDto.parts.map((p) => p.material_number);
      if (new Set(materialNumbers).size !== materialNumbers.length) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Duplicate material numbers are not allowed',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if material numbers already exist in database
      for (const materialNumber of materialNumbers) {
        const existingCavity = await this.machineCavityModel.findOne({
          'parts.material_number': materialNumber,
        });

        if (existingCavity) {
          throw new HttpException(
            {
              status: 'error',
              message: `Material number ${materialNumber} already exists`,
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const newCavity = await this.machineCavityModel.create(createDto);
      return {
        status: 'success',
        message: 'Created machine cavity successfully',
        data: [newCavity],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to create machine cavity',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdateMasterCavityDto,
  ): Promise<ResponseFormat<MasterCavity>> {
    try {
      // ถ้ามีการอัพเดท parts
      if (updateDto.parts) {
        // ตรวจสอบ duplicate material numbers
        const materialNumbers = updateDto.parts.map((p) => p.material_number);
        if (new Set(materialNumbers).size !== materialNumbers.length) {
          throw new HttpException(
            {
              status: 'error',
              message: 'Duplicate material numbers are not allowed',
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // ตรวจสอบว่า material_number ที่จะอัพเดทไม่ซ้ำกับ records อื่น
        for (const part of updateDto.parts) {
          if (part.material_number) {
            const existingCavity = await this.machineCavityModel.findOne({
              _id: { $ne: id }, // ไม่รวม record ปัจจุบัน
              'parts.material_number': part.material_number,
            });

            if (existingCavity) {
              throw new HttpException(
                {
                  status: 'error',
                  message: `Material number ${part.material_number} already exists in another cavity`,
                  data: [],
                },
                HttpStatus.BAD_REQUEST,
              );
            }
          }
        }
      }

      const updatedCavity = await this.machineCavityModel
        .findByIdAndUpdate(id, updateDto, { new: true })
        .lean();

      if (!updatedCavity) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine cavity not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Updated machine cavity successfully',
        data: [updatedCavity],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update machine cavity',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<ResponseFormat<MasterCavity>> {
    try {
      const deletedCavity = await this.machineCavityModel
        .findByIdAndDelete(id)
        .lean();

      if (!deletedCavity) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Machine cavity not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Deleted machine cavity successfully',
        data: [deletedCavity],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to delete machine cavity',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createFromExistingPart(
    materialNumbers: string[],
    cavityData: Omit<CreateMasterCavityDto, 'parts'>,
  ): Promise<ResponseFormat<MasterCavity>> {
    try {
      // หาข้อมูล parts จาก material numbers ที่ส่งมา
      const parts = await this.masterPartModel
        .find({
          material_number: { $in: materialNumbers },
        })
        .lean();

      // ตรวจสอบว่าเจอ parts ครบตามที่ส่งมาไหม
      if (parts.length !== materialNumbers.length) {
        const foundMaterials = parts.map((p) => p.material_number);
        const notFound = materialNumbers.filter(
          (m) => !foundMaterials.includes(m),
        );

        throw new HttpException(
          {
            status: 'error',
            message: `Material numbers not found: ${notFound.join(', ')}`,
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // ตรวจสอบว่า material numbers เหล่านี้มีใน cavity อื่นหรือไม่
      for (const materialNumber of materialNumbers) {
        const existingCavity = await this.machineCavityModel.findOne({
          'parts.material_number': materialNumber,
        });

        if (existingCavity) {
          throw new HttpException(
            {
              status: 'error',
              message: `Material number ${materialNumber} already exists in another cavity`,
              data: [],
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // แปลงข้อมูลจาก parts ให้ตรงกับ CreatePartDto
      const cavityParts = parts.map((part) => ({
        material_number: part.material_number,
        material_description: part.material_description,
        part_number: part.part_number,
        part_name: part.part_name,
        weight: part.weight,
      }));

      // สร้าง cavity ใหม่
      const createDto = {
        ...cavityData,
        parts: cavityParts,
      };

      const newCavity = await this.machineCavityModel.create(createDto);

      return {
        status: 'success',
        message: 'Created machine cavity from existing parts successfully',
        data: [newCavity],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to create machine cavity',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
