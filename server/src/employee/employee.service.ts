import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/shared/interface';
import { Employee } from 'src/shared/modules/schema/employee.schema';
import { SqlService } from 'src/shared/services/sql.service';
import e from 'express';
import { formatDate } from 'src/shared/utils/date.utils';
import { CreateTempEmployeeDto } from 'src/auth/dto/create-temp-employee.dto';
import { User } from 'src/shared/modules/schema/user.schema';
import { UserWithEmployeeData } from 'src/shared/interface/employee';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);
  private readonly BATCH_SIZE = 100;

  constructor(
    @InjectModel(Employee.name) private readonly employeeModel: Model<Employee>,
    @InjectModel('User') private readonly userModel: Model<User>,
    @Inject(SqlService) private readonly sqlService: SqlService,
  ) {}

  private transformEmployeeData(sqlEmployee: any): Partial<Employee> {
    return {
      employee_id: sqlEmployee.EMP_Code,
      prior_name: sqlEmployee.PriorName || null,
      first_name: sqlEmployee.FirstName || null,
      last_name: sqlEmployee.LastName || null,
      section: sqlEmployee.Section || null,
      department: sqlEmployee.Department || null,
      position: sqlEmployee.Position || null,
      company_code: sqlEmployee.Company_Code || null,
      resign_status: sqlEmployee.ResignStatus || null,
      job_start: formatDate(sqlEmployee.JobStart) || null,
      updated_at: new Date(),
      is_temporary: 'false',
    };
  }

  private async fetchSQLEmployees(): Promise<any[]> {
    const query = `
      SELECT 
        EMP_Code,
        PriorName,
        FirstName,
        LastName,
        Section,
        Department,
        Position,
        Company_Code,
        ResignStatus,
        JobStart
      FROM [SNC-SAP].[dbo].[View_Employees_SEREN]
      WHERE Department = 'DL.INJECTION'
    `;

    try {
      const startTime = Date.now();
      const result = await this.sqlService.query(query);
      const duration = Date.now() - startTime;

      this.logger.log(
        `Fetched ${result.length} employees from SQL in ${duration}ms`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error fetching SQL employees:', error.stack);
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to fetch employees from SQL',
          data: [],
        },
        500,
      );
    }
  }

  async syncEmployees(): Promise<ResponseFormat<any>> {
    const syncStartTime = Date.now();
    const errors: Array<{ employee_id: string; error: string }> = [];
    let syncedCount = 0;

    try {
      // 1. Fetch SQL data
      const sqlEmployees = await this.fetchSQLEmployees();
      const sqlEmployeeIds = new Set(sqlEmployees.map((emp) => emp.EMP_Code));

      // 2. Prepare bulk operations
      const bulkOps = sqlEmployees.map((sqlEmployee) => ({
        updateOne: {
          filter: { employee_id: sqlEmployee.EMP_Code },
          update: { $set: this.transformEmployeeData(sqlEmployee) },
          upsert: true,
        },
      }));

      // 3. Process in batches
      for (let i = 0; i < bulkOps.length; i += this.BATCH_SIZE) {
        const batch = bulkOps.slice(i, i + this.BATCH_SIZE);
        try {
          const result = await this.employeeModel.bulkWrite(batch, {
            ordered: false,
          });
          syncedCount += result.modifiedCount + result.upsertedCount;
        } catch (error) {
          this.handleBulkWriteError(
            error,
            sqlEmployees.slice(i, i + this.BATCH_SIZE),
            errors,
          );
        }
      }

      // 4. Cleanup operations in parallel
      await Promise.all([
        // Remove employees not in SQL
        this.employeeModel.deleteMany({
          employee_id: { $nin: Array.from(sqlEmployeeIds) },
          is_temporary: { $eq: 'false' },
        }),
        // Remove matching temporary employees
        this.employeeModel.deleteMany({
          employee_id: {
            $in: Array.from(sqlEmployeeIds),
          },
          is_temporary: { $eq: 'true' },
        }),
      ]);

      const duration = Date.now() - syncStartTime;
      this.logger.log(
        `Sync completed in ${duration}ms. Synced ${syncedCount} employees`,
      );

      return {
        status: 'success',
        message: `Successfully synced ${syncedCount} employees in ${duration}ms`,
        data: [
          {
            syncedCount,
            duration,
            errors: errors.length > 0 ? errors : undefined,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Sync failed:', error.stack);
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to sync employees: ' + error.message,
          data: [],
        },
        500,
      );
    }
  }

  private handleBulkWriteError(error: any, batch: any[], errors: any[]) {
    if (error.writeErrors) {
      error.writeErrors.forEach((writeError) => {
        const failedEmployee = batch[writeError.index];
        errors.push({
          employee_id: failedEmployee.EMP_Code,
          error: writeError.errmsg,
        });
      });
    } else {
      errors.push({
        employee_id: 'BATCH_ERROR',
        error: error.message,
      });
    }
  }

  async getSyncStatus(): Promise<ResponseFormat<any>> {
    try {
      const startTime = Date.now();
      const [totalEmployees, totalTemporaryEmployees] = await Promise.all([
        this.employeeModel.countDocuments(),
        this.employeeModel
          .findOne({}, { updated_at: 1 })
          .sort({ updated_at: -1 })
          .lean(),
      ]);

      return {
        status: 'success',
        message: 'Sync status retrieved successfully',
        data: [
          {
            totalEmployees,
            totalTemporaryEmployees,
            retrievalTime: Date.now() - startTime,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Error getting sync status:', error.stack);
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to get sync status',
          data: [],
        },
        500,
      );
    }
  }

  async validateSync(): Promise<ResponseFormat<any>> {
    try {
      const startTime = Date.now();
      const [sqlEmployees, mongoEmployees] = await Promise.all([
        this.fetchSQLEmployees(),
        this.employeeModel.find({}, { employee_id: 1 }).lean(),
      ]);

      const sqlIds = new Set(sqlEmployees.map((emp) => emp.EMP_Code));
      const mongoIds = new Set(mongoEmployees.map((emp) => emp.employee_id));

      const missingInMongo = [...sqlIds].filter((id) => !mongoIds.has(id));
      const extraInMongo = [...mongoIds].filter((id) => !sqlIds.has(id));

      return {
        status: 'success',
        message: 'Validation completed successfully',
        data: [
          {
            isValid: missingInMongo.length === 0 && extraInMongo.length === 0,
            sqlCount: sqlIds.size,
            mongoCount: mongoIds.size,
            discrepancy: Math.abs(sqlIds.size - mongoIds.size),
            missingInMongo:
              missingInMongo.length > 0 ? missingInMongo : undefined,
            extraInMongo: extraInMongo.length > 0 ? extraInMongo : undefined,
            validationTime: Date.now() - startTime,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Validation failed:', error.stack);
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to validate sync',
          data: [],
        },
        500,
      );
    }
  }

  async findAllEmployee(): Promise<ResponseFormat<Employee>> {
    try {
      const employees = await this.employeeModel.aggregate([
        {
          $lookup: {
            from: 'users', // collection name
            localField: 'employee_id', // field from employee collection
            foreignField: 'employee_id', // field from users collection
            as: 'user_data', // alias for the joined data
          },
        },
        {
          $unwind: {
            path: '$user_data',
            preserveNullAndEmptyArrays: true, // keep employees even if they don't have user accounts
          },
        },
        {
          $project: {
            employee_id: 1,
            prior_name: 1,
            first_name: 1,
            last_name: 1,
            section: 1,
            department: 1,
            position: 1,
            company_code: 1,
            resign_status: 1,
            job_start: 1,
            is_temporary: 1,
            role: {
              $ifNull: ['$user_data.role', null], // MongoDB's way of handling null coalescing
            }, // include user role
            user_id: {
              $ifNull: ['$user_data._id', null], // include user id
            },
            // exclude password for security
          },
        },
      ]);
      return {
        status: 'success',
        message: 'Users retrieved successfully',
        data: employees,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
      return {
        status: 'error',
        message: 'Failed to retrieve users',
        data: [],
      };
    }
  }

  async createTempEmpolyee(
    createTempEmployeeDto: CreateTempEmployeeDto,
  ): Promise<ResponseFormat<Employee>> {
    try {
      const TemporaryEmployeeData = {
        employee_id: createTempEmployeeDto.employee_id,
        prior_name: createTempEmployeeDto.prior_name,
        first_name: createTempEmployeeDto.first_name,
        last_name: createTempEmployeeDto.last_name,
        section: createTempEmployeeDto.section,
        department: createTempEmployeeDto.department,
        position: createTempEmployeeDto.position,
        company_code: createTempEmployeeDto.company_code,
        resign_status: createTempEmployeeDto.resign_status,
        job_start: createTempEmployeeDto.job_start,
        is_temporary: 'true',
      };

      const employee = await this.employeeModel.findOne({
        employee_id: TemporaryEmployeeData.employee_id,
      });

      if (employee) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Employee already exists',
            data: [],
          },
          HttpStatus.CONFLICT,
        );
      }

      await this.employeeModel.create(TemporaryEmployeeData);
      return {
        status: 'success',
        message: 'Temporary employee created successfully',
        data: [],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // ส่งต่อ HTTP exceptions ที่เราสร้างเอง
      }
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to create temporary employee :' + error.message,
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAllUsers(): Promise<ResponseFormat<UserWithEmployeeData>> {
    try {
      const users = await this.employeeModel.aggregate([
        {
          $lookup: {
            from: 'users', // collection name
            localField: 'employee_id', // field from employee collection
            foreignField: 'employee_id', // field from users collection
            as: 'user_data', // alias for the joined data
          },
        },
        {
          $unwind: {
            path: '$user_data',
            preserveNullAndEmptyArrays: false, // keep employees even if they don't have user accounts
          },
        },
        {
          $project: {
            employee_id: 1,
            prior_name: 1,
            first_name: 1,
            last_name: 1,
            position: 1,
            role: {
              $ifNull: ['$user_data.role', null], // MongoDB's way of handling null coalescing
            }, // include user role
            user_id: {
              $ifNull: ['$user_data._id', null], // include user id
            },
            // exclude password for security
          },
        },
      ]);

      if (!users.length) {
        throw new HttpException(
          {
            status: 'error',
            message: 'No users found',
            data: [],
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        status: 'success',
        message: 'Users retrieved successfully',
        data: users,
      };
    } catch (error) {
      // Log error for monitoring
      console.error('Error in findAllUsers:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to retrieve users',
          data: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
