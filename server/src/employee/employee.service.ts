import { HttpException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResponseFormat } from 'src/interface';
import { Employee } from 'src/schema/employee.schema';
import { TemporaryEmployee } from 'src/schema/temporary-employees.schema';
import { SqlService } from 'src/shared/services/sql.service';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectModel(Employee.name) private readonly employeeModel: Model<Employee>,
    @InjectModel(TemporaryEmployee.name)
    private readonly temporaryEmployeeModel: Model<TemporaryEmployee>,
    @Inject(SqlService) private readonly sqlService: SqlService,
  ) {}

  private transformEmployeeData(sqlEmployee: any): Partial<Employee> {
    return {
      employee_id: sqlEmployee.EMP_Code,
      prior_name: sqlEmployee.PriorName,
      first_name: sqlEmployee.FirstName,
      last_name: sqlEmployee.LastName,
      section: sqlEmployee.Section,
      department: sqlEmployee.Department,
      position: sqlEmployee.Position,
      company_code: sqlEmployee.Company_Code,
      resign_status: sqlEmployee.ResignStatus,
      job_start: sqlEmployee.JobStart,
    };
  }

  /**
   * Fetches employee data from SQL Server
   */
  private async fetchSQLEmployees(): Promise<any[]> {
    try {
      return await this.sqlService.query(`
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
        where Department = 'DL.INJECTION'
      `);
    } catch (error) {
      console.error('Error fetching SQL employees:', error);
      throw error;
    }
  }

  /**
   * Syncs employees from SQL to MongoDB
   */
  async syncEmployees(): Promise<ResponseFormat<any>> {
    try {
      // Fetch SQL data
      const sqlEmployees = await this.fetchSQLEmployees();
      const errors = [];
      let syncedCount = 0;

      const sqlEmployeeIds = sqlEmployees.map((emp) => emp.EMP_Code);

      // Process each employee
      for (const sqlEmployee of sqlEmployees) {
        try {
          const employeeData = this.transformEmployeeData(sqlEmployee);

          // Update or create employee in MongoDB
          await this.employeeModel.findOneAndUpdate(
            { employee_id: employeeData.employee_id },
            employeeData,
            { upsert: true, new: true },
          );

          // Remove matching temporary employee if exists
          await this.temporaryEmployeeModel.deleteOne({
            employee_id: employeeData.employee_id,
          });

          syncedCount++;
        } catch (error) {
          errors.push({
            employee_id: sqlEmployee.EMP_Code,
            error: error.message,
          });
        }
      }

      const deleteResult = await this.employeeModel.deleteMany({
        employee_id: { $nin: sqlEmployeeIds },
      });

      return {
        status: 'success',
        message: `Successfully synced ${syncedCount} employees`,
        data: {
          syncedCount,
          deletedCount: deleteResult.deletedCount,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Failed to sync employees :' + error.message,
          data: [],
        },
        500,
      );
    }
  }

  /**
   * Gets the sync status including counts from both collections
   */
  async getSyncStatus(): Promise<{
    totalEmployees: number;
    totalTemporaryEmployees: number;
    lastSyncDate?: Date;
  }> {
    const [totalEmployees, totalTemporaryEmployees] = await Promise.all([
      this.employeeModel.countDocuments(),
      this.temporaryEmployeeModel.countDocuments(),
    ]);

    // You might want to store lastSyncDate in a separate collection
    // This is just a placeholder
    return {
      totalEmployees,
      totalTemporaryEmployees,
    };
  }

  /**
   * Validates sync results by comparing counts
   */
  async validateSync(): Promise<{
    isValid: boolean;
    sqlCount: number;
    mongoCount: number;
    discrepancy?: number;
  }> {
    const sqlCount = (await this.fetchSQLEmployees()).length;
    const mongoCount = await this.employeeModel.countDocuments();

    return {
      isValid: sqlCount === mongoCount,
      sqlCount,
      mongoCount,
      discrepancy: Math.abs(sqlCount - mongoCount),
    };
  }
}
