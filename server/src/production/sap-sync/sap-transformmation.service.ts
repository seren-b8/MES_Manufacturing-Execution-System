import { Injectable } from '@nestjs/common';
import { ISAPConfirmationLog } from 'src/shared/interface/sap';
import { SqlService } from 'src/shared/services/sql.service';

@Injectable()
export class SAPDataTransformationService {
  // แปลงข้อมูลให้ตรงกับ format ที่ SAP ต้องการ
  transformToSAPFormat(data: any): ISAPConfirmationLog {
    const now = new Date();
    const tid = this.generateTID(data.employee_id || 'SNC');

    return {
      MANDT: '700', // ค่าคงที่
      TID: tid,
      ITEMNO: 1,
      EMPLOYEE: data.employee_id?.toString().padStart(12, ' ') || 'SNC',
      AUFNR: `00${data.order_id}`.slice(-12),
      APLFL: `00000${data.sequence_no}`.slice(-6),
      VORNR: `00${data.activity}`.slice(-4),
      UVORN: '',
      LMNGA: Number(data.quantity),
      MEINH: 'ST',
      XMNGA: Number(data.is_not_good ? data.quantity : 0),
      RMNGA: 0,
      RUECK: '',
      RMZHL: '',
      BUDAT: this.formatDate(now),
      ISMNG: Number(data.quantity),
      ISMNGEH: 'STD',
      POSTED: '',
      MESSAGE: '',
      ERDAT: this.formatDate(now),
      ERZET: this.formatTime(now),
      ERNAM: 'ADMINIT',
      WERKS: '1620',
      AGRND: data.case_ng || '',
      TILE: 'Team',
    };
  }

  private generateTID(employeeId: string): string {
    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '');
    return `${timestamp}${employeeId}`.slice(0, 32);
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 8).replace(/:/g, '');
  }
}
