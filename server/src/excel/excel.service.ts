import { Injectable, Logger } from '@nestjs/common';
import { ResponseFormat } from 'src/shared/interface';
import * as XLSX from 'xlsx';

@Injectable()
export class ExcelService {
  private readonly logger = new Logger(ExcelService.name);

  /**
   * อ่านไฟล์ Excel จาก file path หรือ buffer
   * @param source file path (string) หรือ buffer
   * @param options ตัวเลือกเพิ่มเติมสำหรับการอ่านไฟล์
   * @returns ข้อมูลจาก Excel ในรูปแบบ JSON array
   */
  readExcelFile(
    source: string | Buffer,
    options?: {
      sheetName?: string;
      header?: number;
      range?: string;
      defval?: any;
    },
  ): any[] {
    try {
      let workbook: XLSX.WorkBook;

      // ตรวจสอบประเภทของ source
      if (typeof source === 'string') {
        // อ่านจาก file path
        this.logger.debug(`Reading Excel file from path: ${source}`);
        workbook = XLSX.readFile(source);
      } else if (Buffer.isBuffer(source)) {
        // อ่านจาก buffer
        this.logger.debug('Reading Excel file from buffer');
        workbook = XLSX.read(source, { type: 'buffer' });
      } else {
        throw new Error(
          'Invalid source type. Expected string (file path) or Buffer.',
        );
      }

      // เลือก sheet ที่จะอ่าน
      const sheetName = options?.sheetName || workbook.SheetNames[0];

      if (!workbook.Sheets[sheetName]) {
        throw new Error(
          `Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`,
        );
      }

      const worksheet = workbook.Sheets[sheetName];

      // ตัวเลือกสำหรับการแปลง sheet เป็น JSON
      const jsonOptions: XLSX.Sheet2JSONOpts = {
        header: options?.header,
        defval: options?.defval || '',
        ...(options?.range && { range: options.range }),
      };

      const data = XLSX.utils.sheet_to_json(worksheet, jsonOptions);

      this.logger.debug(
        `Successfully read ${data.length} rows from Excel file`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to read Excel file: ${(error as Error).message}`,
      );
      throw new Error(`Excel file reading failed: ${(error as Error).message}`);
    }
  }

  /**
   * อ่านไฟล์ Excel และส่งกลับผลลัพธ์ในรูปแบบ ResponseFormat
   * @param source file path หรือ buffer
   * @param options ตัวเลือกเพิ่มเติม
   * @returns ResponseFormat ที่มีข้อมูลจาก Excel
   */
  async readExcelFileWithResponse(
    source: string | Buffer,
    options?: {
      sheetName?: string;
      header?: number;
      range?: string;
      defval?: any;
    },
  ): Promise<ResponseFormat<any>> {
    try {
      const data = this.readExcelFile(source, options);

      return {
        status: 'success',
        message: `Successfully read ${data.length} rows from Excel file`,
        data: data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to read Excel file: ${(error as Error).message}`,
        data: [],
      };
    }
  }

  /**
   * รับข้อมูลเกี่ยวกับ workbook (sheet names, etc.)
   * @param source file path หรือ buffer
   * @returns ข้อมูล workbook
   */
  getWorkbookInfo(source: string | Buffer): {
    sheetNames: string[];
    sheetCount: number;
    sheets: {
      [key: string]: { range: string; rowCount: number; colCount: number };
    };
  } {
    try {
      let workbook: XLSX.WorkBook;

      if (typeof source === 'string') {
        workbook = XLSX.readFile(source);
      } else if (Buffer.isBuffer(source)) {
        workbook = XLSX.read(source, { type: 'buffer' });
      } else {
        throw new Error('Invalid source type');
      }

      const sheets: {
        [key: string]: { range: string; rowCount: number; colCount: number };
      } = {};

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const range = worksheet['!ref'] || 'A1';
        const decoded = XLSX.utils.decode_range(range);

        sheets[sheetName] = {
          range: range,
          rowCount: decoded.e.r - decoded.s.r + 1,
          colCount: decoded.e.c - decoded.s.c + 1,
        };
      });

      return {
        sheetNames: workbook.SheetNames,
        sheetCount: workbook.SheetNames.length,
        sheets,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get workbook info: ${(error as Error).message}`,
      );
      throw new Error(
        `Failed to get workbook info: ${(error as Error).message}`,
      );
    }
  }

  /**
   * อ่านหลาย sheets จาก Excel file
   * @param source file path หรือ buffer
   * @param sheetNames array ของ sheet names ที่ต้องการอ่าน (ถ้าไม่ระบุจะอ่านทุก sheet)
   * @returns object ที่มีข้อมูลแต่ละ sheet
   */
  readMultipleSheets(
    source: string | Buffer,
    sheetNames?: string[],
  ): { [sheetName: string]: any[] } {
    try {
      let workbook: XLSX.WorkBook;

      if (typeof source === 'string') {
        workbook = XLSX.readFile(source);
      } else if (Buffer.isBuffer(source)) {
        workbook = XLSX.read(source, { type: 'buffer' });
      } else {
        throw new Error('Invalid source type');
      }

      const sheetsToRead = sheetNames || workbook.SheetNames;
      const result: { [sheetName: string]: any[] } = {};

      sheetsToRead.forEach((sheetName) => {
        if (workbook.Sheets[sheetName]) {
          const worksheet = workbook.Sheets[sheetName];
          result[sheetName] = XLSX.utils.sheet_to_json(worksheet);
          this.logger.debug(
            `Read ${result[sheetName].length} rows from sheet: ${sheetName}`,
          );
        } else {
          this.logger.warn(`Sheet "${sheetName}" not found`);
        }
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to read multiple sheets: ${(error as Error).message}`,
      );
      throw new Error(
        `Failed to read multiple sheets: ${(error as Error).message}`,
      );
    }
  }

  /**
   * ตรวจสอบว่าไฟล์เป็น Excel file หรือไม่
   * @param buffer file buffer
   * @param filename ชื่อไฟล์ (optional)
   * @returns boolean
   */
  isExcelFile(buffer: Buffer, filename?: string): boolean {
    try {
      // ตรวจสอบจาก file extension
      if (filename) {
        const ext = filename.toLowerCase().split('.').pop();
        if (!['xlsx', 'xls', 'xlsm', 'xlsb'].includes(ext || '')) {
          return false;
        }
      }

      // ตรวจสอบจาก buffer โดยพยายามอ่านไฟล์
      XLSX.read(buffer, { type: 'buffer' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * สร้าง Excel file จากข้อมูล
   * @param data ข้อมูลที่จะเขียนลง Excel
   * @param sheetName ชื่อ sheet (default: 'Sheet1')
   * @returns Buffer ของไฟล์ Excel
   */
  createExcelFile(data: any[], sheetName: string = 'Sheet1'): Buffer {
    try {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      this.logger.debug(`Created Excel file with ${data.length} rows`);
      return buffer;
    } catch (error) {
      this.logger.error(
        `Failed to create Excel file: ${(error as Error).message}`,
      );
      throw new Error(
        `Failed to create Excel file: ${(error as Error).message}`,
      );
    }
  }

  /**
   * สร้าง Excel file จากข้อมูลหลาย sheets
   * @param sheetsData object ที่มี sheet name เป็น key และข้อมูลเป็น value
   * @returns Buffer ของไฟล์ Excel
   */
  createMultiSheetExcelFile(sheetsData: {
    [sheetName: string]: any[];
  }): Buffer {
    try {
      const workbook = XLSX.utils.book_new();

      Object.entries(sheetsData).forEach(([sheetName, data]) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        this.logger.debug(
          `Added sheet "${sheetName}" with ${data.length} rows`,
        );
      });

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      this.logger.debug('Created multi-sheet Excel file');
      return buffer;
    } catch (error) {
      this.logger.error(
        `Failed to create multi-sheet Excel file: ${(error as Error).message}`,
      );
      throw new Error(
        `Failed to create multi-sheet Excel file: ${(error as Error).message}`,
      );
    }
  }

  /**
   * แปลง Excel column letter เป็น number (A=1, B=2, ...)
   * @param column column letter (เช่น 'A', 'B', 'AA')
   * @returns column number
   */
  columnLetterToNumber(column: string): number {
    return XLSX.utils.decode_col(column) + 1;
  }

  /**
   * แปลง column number เป็น letter (1=A, 2=B, ...)
   * @param number column number
   * @returns column letter
   */
  columnNumberToLetter(number: number): string {
    return XLSX.utils.encode_col(number - 1);
  }
}
