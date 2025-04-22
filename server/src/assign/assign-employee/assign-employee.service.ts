// assign-employee.service.ts
import { Injectable, HttpStatus, HttpException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { isValidObjectId, Model, mongo } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { AssignEmployee } from 'src/shared/modules/schema/assign-employee.schema';
import {
  CloseByUserDto,
  CreateAssignEmployeeDto,
  UpdateAssignEmployeeDto,
} from '../dto/assign-employee.dto';
import { User } from 'src/shared/modules/schema/user.schema';
import { AssignOrder } from 'src/shared/modules/schema/assign-order.schema';
import { IAssignEmployeeDocument } from 'src/shared/interface/assign.emp';
import * as moment from 'moment-timezone';
import { error } from 'console';
import e from 'express';

@Injectable()
export class AssignEmployeeService {
  constructor(
    @InjectModel('AssignEmployee')
    private assignEmployeeModel: Model<AssignEmployee>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('AssignOrder') private assignOrderModel: Model<AssignOrder>,
  ) {}

  private isValidStatusTransition(
    currentStatus: string,
    newStatus: string,
  ): boolean {
    const validTransitions = {
      active: ['completed', 'suspended'],
      suspended: ['active', 'completed'],
      completed: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus);
  }

  async create(
    createDto: CreateAssignEmployeeDto,
  ): Promise<ResponseFormat<IAssignEmployeeDocument>> {
    try {
      const user = await this.userModel.findById(createDto.user_id);

      if (!user) {
        throw new HttpException(
          {
            status: 'error',
            message: 'not found user',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const assignOrder = await this.assignOrderModel.findOne({
        _id: createDto.assign_order_id,
        status: 'active',
      });

      if (!assignOrder) {
        throw new HttpException(
          {
            status: 'error',
            message: 'assign order not found or not active',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const activeOrders = await this.assignOrderModel.find({
        machine_number: assignOrder.machine_number,
        status: 'active',
      });

      // สร้าง array เพื่อเก็บ assignments ที่สร้างสำเร็จ
      const createdAssignments = [];
      let skippedCount = 0;
      let deletedCount = 0;
      let failedCount = 0;

      // ตรวจสอบก่อนว่า main assignment มีอยู่แล้วหรือไม่
      const mainExistingAssignment = await this.assignEmployeeModel.findOne({
        user_id: createDto.user_id.toString(),
        assign_order_id: createDto.assign_order_id.toString(),
        status: 'active',
      });

      // ถ้ามี main assignment อยู่แล้ว ให้ใช้อันนั้นเลย
      if (mainExistingAssignment) {
        // Loop ข้อมูลจาก activeOrders และสร้าง assignment เฉพาะอันที่ยังไม่มี
        for (const order of activeOrders) {
          try {
            // ข้ามถ้าเป็น main order เพราะมีอยู่แล้ว
            if (order._id.toString() === createDto.assign_order_id.toString()) {
              skippedCount++;
              continue;
            }

            // ตรวจสอบว่ามี assignment อยู่แล้วหรือไม่
            const existingAssignment = await this.assignEmployeeModel.findOne({
              user_id: createDto.user_id,
              assign_order_id: order._id.toString(),
              status: 'active',
            });

            if (existingAssignment) {
              skippedCount++;
              continue; // ข้ามไปทำ order ถัดไป
            }

            // ลบ assignment เก่าที่ไม่ active (ถ้ามี)
            const deleteResult = await this.assignEmployeeModel.deleteMany({
              user_id: createDto.user_id,
              assign_order_id: order._id.toString(),
              status: { $ne: 'active' },
            });

            if (deleteResult.deletedCount > 0) {
              deletedCount += deleteResult.deletedCount;
            }

            // สร้าง assignment ใหม่
            const newAssignment = new this.assignEmployeeModel({
              user_id: createDto.user_id,
              assign_order_id: order._id.toString(),
              status: 'active',
              log_date: new Date(),
            });

            const savedAssignment = await newAssignment.save();

            // เก็บ assignment ที่สร้างสำเร็จ
            createdAssignments.push(savedAssignment);
          } catch (error) {
            // ถ้าเป็น error อื่น ให้บันทึกและทำต่อ
            console.error(`Error processing order ${order._id}:`, error);
            failedCount++;
          }
        }

        // ส่งคืน main assignment ที่มีอยู่แล้ว
        return {
          status: 'success',
          message: `Employee already assigned. Created ${createdAssignments.length} additional assignments, skipped ${skippedCount}, failed ${failedCount}.`,
          data: [mainExistingAssignment.toObject() as IAssignEmployeeDocument],
        };
      }
      // กรณีไม่มี main assignment
      else {
        // Loop ข้อมูลจาก activeOrders และสร้าง assignment ทีละอัน
        for (const order of activeOrders) {
          try {
            // ตรวจสอบว่ามี assignment อยู่แล้วหรือไม่
            const existingAssignment = await this.assignEmployeeModel.findOne({
              user_id: createDto.user_id,
              assign_order_id: order._id.toString(),
              status: 'active',
            });

            if (existingAssignment) {
              skippedCount++;
              continue; // ข้ามไปทำ order ถัดไป
            }

            // ลบ assignment เก่าที่ไม่ active (ถ้ามี)
            const deleteResult = await this.assignEmployeeModel.deleteMany({
              user_id: createDto.user_id,
              assign_order_id: order._id.toString(),
              status: { $ne: 'active' },
            });

            if (deleteResult.deletedCount > 0) {
              deletedCount += deleteResult.deletedCount;
            }

            // สร้าง assignment ใหม่
            const newAssignment = new this.assignEmployeeModel({
              user_id: createDto.user_id,
              assign_order_id: order._id.toString(),
              status: 'active',
              log_date: new Date(),
            });

            const savedAssignment = await newAssignment.save();

            // เก็บ assignment ที่สร้างสำเร็จ
            createdAssignments.push(savedAssignment);
          } catch (error) {
            // ถ้าเป็น error อื่น ให้บันทึกและทำต่อ
            console.error(`Error processing order ${order._id}:`, error);
            failedCount++;
          }
        }

        // หา assignment ของ order หลักที่ถูกสร้าง
        const mainAssignment = createdAssignments.find(
          (assignment) =>
            assignment.assign_order_id.toString() ===
            createDto.assign_order_id.toString(),
        );

        if (!mainAssignment) {
          throw new HttpException(
            {
              status: 'error',
              message: 'Failed to create main assignment',
              data: [],
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        return {
          status: 'success',
          message: `Employee assigned successfully. Created ${createdAssignments.length} assignments, skipped ${skippedCount}, failed ${failedCount}.`,
          data: [mainAssignment.toObject() as IAssignEmployeeDocument],
        };
      }
    } catch (error) {
      console.error('Error in create:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to assign employee',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByAssignOrder(
    assignOrderId: string,
  ): Promise<ResponseFormat<AssignEmployee>> {
    try {
      const assignments = await this.assignEmployeeModel
        .find({ assign_order_id: assignOrderId })
        .sort({ log_date: -1 });

      return {
        status: 'success',
        message: 'Employee assignments retrieved successfully',
        data: assignments,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve employee assignments',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findActiveByUser(
    userId: string,
  ): Promise<ResponseFormat<AssignEmployee>> {
    try {
      const assignments = await this.assignEmployeeModel.find({
        user_id: userId,
        status: 'active',
      });

      return {
        status: 'success',
        message: 'Active assignments retrieved successfully',
        data: assignments,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve active assignments',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdateAssignEmployeeDto,
  ): Promise<ResponseFormat<AssignEmployee>> {
    try {
      const assignment = await this.assignEmployeeModel.findById(id);
      if (!assignment) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Assignment not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Validate status transition
      if (
        updateDto.status &&
        !this.isValidStatusTransition(assignment.status, updateDto.status)
      ) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Invalid status transition',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatedAssignment =
        await this.assignEmployeeModel.findByIdAndUpdate(
          id,
          { $set: updateDto },
          { new: true },
        );

      return {
        status: 'success',
        message: 'Assignment updated successfully',
        data: [updatedAssignment],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to update assignment',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async closeByAssignOrder(
    assignOrderId: string,
  ): Promise<ResponseFormat<AssignEmployee>> {
    try {
      const activeAssignments = await this.assignEmployeeModel.find({
        assign_order_id: assignOrderId,
        status: 'active',
      });

      const updatePromises = activeAssignments.map((assignment) =>
        this.assignEmployeeModel.findByIdAndUpdate(
          assignment._id,
          { $set: { status: 'completed' } },
          { new: true },
        ),
      );

      const updatedAssignments = await Promise.all(updatePromises);

      return {
        status: 'success',
        message: 'Assignments closed successfully',
        data: updatedAssignments,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to close assignments',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async closeByUser(
    closeByUserDto: CloseByUserDto,
  ): Promise<ResponseFormat<IAssignEmployeeDocument>> {
    try {
      // ตรวจสอบความถูกต้องของ ID
      if (!isValidObjectId(closeByUserDto.assign_order_id)) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Invalid assign order ID format',
            data: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // ตรวจสอบว่ามีผู้ใช้นี้หรือไม่
      const user = await this.userModel.findById(closeByUserDto.user_id);
      if (!user) {
        throw new HttpException(
          {
            status: 'error',
            message: 'User not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ค้นหา assign order ที่ระบุ
      const mainAssignOrder = await this.assignOrderModel.findById(
        closeByUserDto.assign_order_id,
      );
      if (!mainAssignOrder) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Assign order not found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ค้นหา assignment หลักที่จะปิด
      const mainAssignment = await this.assignEmployeeModel.findOne({
        user_id: closeByUserDto.user_id,
        assign_order_id: closeByUserDto.assign_order_id,
        status: 'active',
      });

      if (!mainAssignment) {
        // แทนที่จะแจ้ง error ทันที ให้ลองตรวจสอบว่ามี inactive assignments ไหม
        const inactiveMainAssignment = await this.assignEmployeeModel.findOne({
          user_id: closeByUserDto.user_id,
          assign_order_id: closeByUserDto.assign_order_id,
        });

        if (inactiveMainAssignment) {
          // ถ้ามี assignment แต่ไม่ active แล้ว ให้ส่งคืนข้อมูลนั้น
          if (inactiveMainAssignment.status === 'completed') {
            return {
              status: 'success',
              message: 'Assignment already completed',
              data: [
                inactiveMainAssignment.toObject() as IAssignEmployeeDocument,
              ],
            };
          }
        }

        throw new HttpException(
          {
            status: 'error',
            message: 'No active assignment found for this user and order',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // ค้นหา assign orders ทั้งหมดที่ใช้เครื่องจักรเดียวกัน
      const relatedOrders = await this.assignOrderModel.find({
        machine_number: mainAssignOrder.machine_number,
        status: 'active',
      });

      // สร้าง array เพื่อเก็บ assignments ที่ปิดสำเร็จ
      const closedAssignments = [];
      let notFoundCount = 0;
      let failedCount = 0;

      // วนลูปปิด assignments ทุกอันที่เกี่ยวข้องกับเครื่องจักรนี้
      for (const order of relatedOrders) {
        try {
          // ใช้ ObjectId แทน string ใน query
          const orderIdStr = order._id.toString();

          // ทดลองค้นหาด้วยเงื่อนไขที่ยืดหยุ่นกว่า (ไม่ระบุ status เพื่อดูว่ามี assignment อยู่ไหม)
          const anyAssignment = await this.assignEmployeeModel.findOne({
            user_id: closeByUserDto.user_id,
            assign_order_id: orderIdStr,
          });

          // ค้นหา active assignment สำหรับ order นี้
          let assignment = await this.assignEmployeeModel.findOne({
            user_id: closeByUserDto.user_id,
            assign_order_id: orderIdStr,
            status: 'active',
          });

          // ลอง query อีกวิธีหนึ่งถ้าไม่พบผลลัพธ์
          if (
            !assignment &&
            mainAssignment &&
            orderIdStr === closeByUserDto.assign_order_id
          ) {
            assignment = mainAssignment;
          }

          // ถ้าไม่พบ assignment ที่ active ให้ข้ามไป
          if (!assignment) {
            notFoundCount++;
            continue;
          }

          // อัพเดท assignment เป็น completed
          const updatedAssignment =
            await this.assignEmployeeModel.findByIdAndUpdate(
              assignment._id,
              {
                $set: {
                  status: 'completed',
                  updated_at: moment().toDate(),
                },
              },
              { new: true, runValidators: true },
            );

          if (updatedAssignment) {
            closedAssignments.push(updatedAssignment);
          } else {
            console.error(`Failed to update assignment ${assignment._id}`);
            failedCount++;
          }
        } catch (error) {
          // ถ้าเกิด error กับ assignment ใดๆ ให้บันทึกและทำต่อ
          console.error(`Error processing order ${order._id}:`, error);
          failedCount++;
        }
      }

      // แม้ไม่มี assignment ใดถูกปิด ให้อัพเดท mainAssignment โดยตรง
      if (closedAssignments.length === 0) {
        try {
          // ลองอัพเดท mainAssignment โดยตรงอีกครั้ง
          const updatedMainAssignment =
            await this.assignEmployeeModel.findByIdAndUpdate(
              mainAssignment._id,
              {
                $set: {
                  status: 'completed',
                  updated_at: moment().toDate(),
                },
              },
              { new: true, runValidators: true },
            );

          if (updatedMainAssignment) {
            closedAssignments.push(updatedMainAssignment);
          }
        } catch (directUpdateError) {
          console.error(
            'Error during direct update of main assignment:',
            directUpdateError,
          );
        }

        // ถ้ายังไม่สำเร็จ ให้ก้มกลับมาเช็คว่ามันถูกอัพเดทไปแล้วหรือไม่
        if (closedAssignments.length === 0) {
          const refreshedMainAssignment =
            await this.assignEmployeeModel.findById(mainAssignment._id);
          if (
            refreshedMainAssignment &&
            refreshedMainAssignment.status === 'completed'
          ) {
            closedAssignments.push(refreshedMainAssignment);
          }
        }
      }

      // ถ้าไม่มี assignment ใดถูกปิด ให้แจ้ง error
      if (closedAssignments.length === 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Failed to close any assignments',
            data: [],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // หา assignment ของ order หลักที่ถูกปิด
      const closedMainAssignment = closedAssignments.find(
        (assignment) =>
          assignment.assign_order_id.toString() ===
          closeByUserDto.assign_order_id.toString(),
      );

      // ถ้าไม่มี main assignment ที่ถูกปิด ใช้ assignment แรกที่ปิดได้แทน
      if (!closedMainAssignment) {
        return {
          status: 'success',
          message: `Successfully closed ${closedAssignments.length} assignment(s), but main assignment was not one of them`,
          data: [closedAssignments[0].toObject() as IAssignEmployeeDocument],
        };
      }

      return {
        status: 'success',
        message: `Successfully closed ${closedAssignments.length} assignment(s)`,
        data: [closedMainAssignment.toObject() as IAssignEmployeeDocument],
      };
    } catch (error) {
      console.error('Error in closeByUser:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to close assignments',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
