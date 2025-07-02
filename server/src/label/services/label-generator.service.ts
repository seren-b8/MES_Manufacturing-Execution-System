import { Injectable } from '@nestjs/common';
import { createCanvas, CanvasRenderingContext2D, loadImage } from 'canvas';
import path from 'path';
import * as fs from 'fs';

import * as QRCode from 'qrcode';
import { ProductionRecord } from 'src/schema/production-record.schema';
// import { CoProductRecord } from '../schemas/co-product-record.schema';

@Injectable()
export class LabelGeneratorService {
  async generate1PartLabel(): Promise<Buffer> {
    const canvas = createCanvas(640, 550);
    const ctx = canvas.getContext('2d');
    const qrData = 'B8MES|NG2EBB5C312-6QLZuGcXSX-3'; // QR data
    const qrBuffer = await QRCode.toBuffer(qrData, {
      width: 150,
      margin: 0,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    const qrImage = await this.loadImage(qrBuffer);

    function drawCenteredText(
      text,
      x,
      y,
      width,
      height,
      font = '20px Arial',
      bold = false,
    ) {
      ctx.font = bold ? `bold ${font}` : font;

      // วัดขนาดข้อความ
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = parseInt(font); // ประมาณจาก font size

      // คำนวณตำแหน่งกึ่งกลาง
      const centerX = x + width / 2 - textWidth / 2;
      const centerY = y + height / 2 + textHeight / 4; // +textHeight/4 เพื่อจัดให้ดูกึ่งกลาง

      ctx.fillText(text, centerX, centerY);
    }

    function drawSmartText(
      text,
      x,
      y,
      width,
      height,
      maxFontSize = 20,
      minFontSize = 10,
    ) {
      if (!text) return;

      const padding = 5;
      const availableWidth = width - padding * 2;
      const availableHeight = height - padding * 2;

      let fontSize = maxFontSize;
      let lines = [];
      let totalHeight = 0;

      // ลองขนาด font จากใหญ่ไปเล็ก
      for (fontSize = maxFontSize; fontSize >= minFontSize; fontSize--) {
        ctx.font = `bold ${fontSize}px Arial`;
        lines = wrapText(text, availableWidth);
        totalHeight = lines.length * (fontSize * 1.2); // line height = fontSize * 1.2

        // ถ้าความสูงรวมไม่เกิน available height ให้หยุด
        if (totalHeight <= availableHeight) {
          break;
        }
      }

      // คำนวณตำแหน่งเริ่มต้น (กึ่งกลางแนวตั้ง)
      const startY =
        y + padding + (availableHeight - totalHeight) / 2 + fontSize;

      // วาดแต่ละบรรทัด
      ctx.fillStyle = '#000000';
      ctx.font = `${fontSize}px Arial`;

      lines.forEach((line, index) => {
        const lineY = startY + index * fontSize * 1.2;
        const textWidth = ctx.measureText(line).width;
        const centerX = x + padding + (availableWidth - textWidth) / 2; // กึ่งกลางแนวนอน

        ctx.fillText(line, centerX, lineY);
      });
    }

    // Function สำหรับ word wrap
    function wrapText(text, maxWidth) {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';

      for (let word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // ถ้าคำเดียวยาวเกินไป ให้ตัดตัวอักษร
            lines.push(...breakLongWord(word, maxWidth));
            currentLine = '';
          }
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    }

    // Function สำหรับตัดคำยาว
    function breakLongWord(word, maxWidth) {
      const lines = [];
      let currentLine = '';

      for (let char of word) {
        const testLine = currentLine + char;
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = char;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    }

    // Function สำหรับวาดกล่องพร้อมข้อความ Smart
    function drawSmartBox(
      x,
      y,
      w,
      h,
      text,
      maxFontSize = 20,
      minFontSize = 10,
    ) {
      // วาดกล่อง
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(x, y, w, h);

      // วาดข้อความ Smart
      drawSmartText(text, x, y, w, h, maxFontSize, minFontSize);
    }

    // Function พิเศษสำหรับข้อมูลสำคัญ (ปรับ font น้อยกว่า)
    function drawImportantBox(x, y, w, h, text) {
      drawSmartBox(x, y, w, h, text, 24, 16); // font ใหญ่กว่า
    }

    // Function สำหรับข้อมูลทั่วไป
    function drawRegularBox(x, y, w, h, text) {
      drawSmartBox(x, y, w, h, text, 20, 12);
    }

    async function drawLabel() {
      // Utils
      const drawText = (text, x, y, font = '16px Arial', bold = false) => {
        ctx.font = bold ? `bold ${font}` : font;
        ctx.fillText(text, x, y);
      };

      const drawBox = (
        x,
        y,
        w,
        h,
        value,
        labelBold = false,
        valueBold = true,
      ) => {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(x, y, w, h);
        drawText(value, x + 5, y + 30, '20px Arial', valueBold);
      };

      const drawLine = (x1, y1, x2, y2) => {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 640, 550);

      // Header
      const iconImage = await loadImage('public/icon/Icon.png');
      ctx.drawImage(iconImage, 5, 5, 50, 50);
      drawLine(65, 0, 65, 50);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('MES B8', 75, 30);
      ctx.font = 'bold 17px Arial';
      ctx.fillText('Manufacturing Execution System B8', 75, 50);

      drawCenteredText('1', 560, 20, 60, 40, '50px Arial', true); // <-- label number

      drawText('Model -', 520, 90, '20px Arial', true); // <-- model
      drawBox(0, 60, 640, 40, 'Customer Name : DAIKIN COMPRESSOR'); // <-- customer name

      // Boxes
      drawLine(100, 100, 100, 380);
      drawBox(0, 100, 640, 40, 'Supplier    Serenity');
      drawBox(0, 140, 350, 40, 'Order ID');

      drawBox(0, 180, 350, 100, '');
      drawText('Part', 5, 220, '25px Arial', true);
      drawText('Code', 5, 245, '25px Arial', true);

      drawBox(0, 280, 350, 100, '');
      drawText('Part', 5, 320, '25px Arial', true);
      drawText('Name', 5, 345, '25px Arial', true);

      drawBox(0, 380, 350, 150, '');
      drawText('Picture of part', 5, 400, '20px Arial', true);

      const partImage = await loadImage('public/icon/Icon.png'); // <-- Placeholder for part image
      ctx.drawImage(partImage, 40, 410, 100, 100);

      ctx.drawImage(qrImage, 200, 380, 150, 150);

      //box data row 1
      drawSmartText('124-9001-929', 100, 140, 250, 40, 25, 12); // <-- Order ID (Smart Text)
      drawSmartText('2PD04462/1-1', 100, 180, 250, 100, 60, 12); // <-- Part Code (Smart Text)
      drawSmartText('B8MES-4900', 100, 280, 250, 100, 60, 12); // <-- Part Name (Smart Text)

      drawLine(450, 140, 450, 380);
      drawBox(350, 140, 290, 40, 'SAP No');
      drawBox(350, 180, 290, 50, "Mat'l");
      drawBox(350, 230, 290, 50, 'Color');
      drawBox(350, 280, 290, 50, 'Producer');
      drawBox(350, 330, 290, 50, 'Date');
      drawBox(350, 380, 290, 150, '');
      drawText('Quantity (Unit)', 360, 400, '20px Arial', true);

      // box data row 2
      drawSmartText('49001929', 450, 140, 190, 40, 20, 12); // <-- SAP No (Smart Text)

      drawSmartText('abasda', 450, 180, 190, 50, 25, 12); // <-- mat (Smart Text)
      drawSmartText('Black', 450, 230, 190, 50, 25, 12); // <-- Color (Smart Text)
      drawSmartText('2611061', 450, 280, 190, 50, 25, 12); // <-- Producer (Smart Text)
      drawSmartText('2023-05-01', 450, 330, 190, 50, 25, 12); // <-- Date (Smart Text)

      // Quantity
      drawCenteredText('10', 470, 440, 50, 50, '95px Arial', true); // <-- quantity

      ctx.font = 'bold 20px Arial';
      ctx.fillText('PCS.', 580, 520);
      ctx.font = 'bold 20px Arial';
      ctx.fillText('RoHS2', 360, 520);

      // Footer
      ctx.font = 'bold 12px Arial';
      ctx.fillText(qrData, 5, 545); // <-- QR Code text
      ctx.fillText(
        'F - PRO – 001 LABEL MES | Effective Date 03–05–2568 Rev.0',
        290,
        545,
      );
    }

    // วาดทันทีที่โหลดหน้า
    await drawLabel();

    return canvas.toBuffer('image/png');
  }

  async generate2PartLabel(): Promise<Buffer> {
    const canvas = createCanvas(640, 550);
    const ctx = canvas.getContext('2d');

    const iconImage = await loadImage('public/icon/Icon.png');
    const partImage1 = await loadImage('public/icon/Icon.png'); // <-- part 1 image
    const partImage2 = await loadImage('public/icon/Icon.png'); // <-- part 2 image

    const labelData = {
      labelNo: '1',
      customer: 'DAIKIN COMPRESSOR',
      supplier: 'SNC SERENITY CO., LTD.',
      mat: 'abasda',
      color: 'Black',
      producer: '2611061',
      date: '2023-05-01',
      part1: {
        orderId: '124-9001-929',
        sapNo: '49001929',
        code: '2PD04462/1-1',
        name: 'B8MES-4900',
        serial: 'B8MES|NG2EBB5C312-6QLZuGcXSX-3',
      },
      part2: {
        orderId: '124-9001-930',
        sapNo: '49001930',
        code: '2PD04462/1-2',
        name: 'B8MES-4901',
        serial: 'B8MES|NG2EBB5C312-6QLZuGcXSX-4',
      },
    };

    const drawQRCode = async (
      qrData: string,
      x: number,
      y: number,
      size: number = 100,
    ): Promise<void> => {
      try {
        const qrBuffer = await QRCode.toBuffer(qrData, {
          width: size,
          margin: 0,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        const qrImage = await this.loadImage(qrBuffer);
        ctx.drawImage(qrImage, x, y, size, size);
      } catch (error) {
        console.error('QR Code generation error:', error);

        // วาดกรอบแทนถ้า error
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, size, size);

        // วาดข้อความ error
        ctx.fillStyle = '#666666';
        ctx.font = '12px Arial';
        const text = 'QR ERROR';
        const textWidth = ctx.measureText(text).width;
        ctx.fillText(text, x + (size - textWidth) / 2, y + size / 2);
      }
    };

    function drawCenteredText(
      text,
      x,
      y,
      width,
      height,
      font = '20px Arial',
      bold = false,
    ) {
      ctx.font = bold ? `bold ${font}` : font;

      // วัดขนาดข้อความ
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = parseInt(font); // ประมาณจาก font size

      // คำนวณตำแหน่งกึ่งกลาง
      const centerX = x + width / 2 - textWidth / 2;
      const centerY = y + height / 2 + textHeight / 4; // +textHeight/4 เพื่อจัดให้ดูกึ่งกลาง

      ctx.fillText(text, centerX, centerY);
    }

    function drawSmartText(
      text,
      x,
      y,
      width,
      height,
      maxFontSize = 20,
      minFontSize = 10,
    ) {
      if (!text) return;

      const padding = 5;
      const availableWidth = width - padding * 2;
      const availableHeight = height - padding * 2;

      let fontSize = maxFontSize;
      let lines = [];
      let totalHeight = 0;

      // ลองขนาด font จากใหญ่ไปเล็ก
      for (fontSize = maxFontSize; fontSize >= minFontSize; fontSize--) {
        ctx.font = `bold ${fontSize}px Arial`;
        lines = wrapText(text, availableWidth);
        totalHeight = lines.length * (fontSize * 1.2); // line height = fontSize * 1.2

        // ถ้าความสูงรวมไม่เกิน available height ให้หยุด
        if (totalHeight <= availableHeight) {
          break;
        }
      }

      // คำนวณตำแหน่งเริ่มต้น (กึ่งกลางแนวตั้ง)
      const startY =
        y + padding + (availableHeight - totalHeight) / 2 + fontSize;

      // วาดแต่ละบรรทัด
      ctx.fillStyle = '#000000';
      ctx.font = `${fontSize}px Arial`;

      lines.forEach((line, index) => {
        const lineY = startY + index * fontSize * 1.2;
        const textWidth = ctx.measureText(line).width;
        const centerX = x + padding + (availableWidth - textWidth) / 2; // กึ่งกลางแนวนอน

        ctx.fillText(line, centerX, lineY);
      });
    }

    // Function สำหรับ word wrap
    function wrapText(text, maxWidth) {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';

      for (let word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // ถ้าคำเดียวยาวเกินไป ให้ตัดตัวอักษร
            lines.push(...breakLongWord(word, maxWidth));
            currentLine = '';
          }
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    }

    // Function สำหรับตัดคำยาว
    function breakLongWord(word, maxWidth) {
      const lines = [];
      let currentLine = '';

      for (let char of word) {
        const testLine = currentLine + char;
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = char;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    }

    // Function สำหรับวาดกล่องพร้อมข้อความ Smart
    function drawSmartBox(
      x,
      y,
      w,
      h,
      text,
      maxFontSize = 20,
      minFontSize = 10,
    ) {
      // วาดกล่อง
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(x, y, w, h);

      // วาดข้อความ Smart
      drawSmartText(text, x, y, w, h, maxFontSize, minFontSize);
    }

    // Function พิเศษสำหรับข้อมูลสำคัญ (ปรับ font น้อยกว่า)
    function drawImportantBox(x, y, w, h, text) {
      drawSmartBox(x, y, w, h, text, 24, 16); // font ใหญ่กว่า
    }

    // Function สำหรับข้อมูลทั่วไป
    function drawRegularBox(x, y, w, h, text) {
      drawSmartBox(x, y, w, h, text, 20, 12);
    }

    async function drawLabel() {
      // Utils
      const drawText = (text, x, y, font = '16px Arial', bold = false) => {
        ctx.font = bold ? `bold ${font}` : font;
        ctx.fillText(text, x, y);
      };

      const drawBox = (
        x,
        y,
        w,
        h,
        value,
        labelBold = false,
        valueBold = true,
      ) => {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(x, y, w, h);
        drawText(
          value,
          x + 5,
          y + 30,
          value == 'Part Code' || value == 'Part Name'
            ? '18px Arial'
            : '20px Arial',
          valueBold,
        );
      };

      const drawLine = (x1, y1, x2, y2) => {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 640, 550);

      // Header

      ctx.drawImage(iconImage, 5, 5, 50, 50);
      drawLine(65, 0, 65, 50);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('MES B8', 75, 30);
      ctx.font = 'bold 17px Arial';
      ctx.fillText('Manufacturing Execution System B8', 75, 50);

      drawCenteredText(labelData.labelNo, 560, 20, 60, 40, '50px Arial', true); // <-- label number

      drawText('Model', 520, 90, '20px Arial', true);
      drawBox(0, 60, 640, 40, `Customer Name : ${labelData.customer}`); // <-- customer name

      // Boxes
      drawLine(100, 100, 100, 380);
      drawBox(0, 100, 640, 40, `Supplier    ${labelData.supplier}`);
      drawBox(0, 140, 350, 40, `Order ID`);

      drawBox(0, 180, 350, 50, 'Part Code');
      drawBox(0, 230, 350, 50, 'Part Name');

      drawBox(0, 280, 350, 50, 'Part Code');
      drawBox(0, 330, 350, 50, 'Part Name');

      drawBox(0, 380, 350, 150, '');
      drawText('Picture of part', 5, 400, '20px Arial', true);
      ctx.drawImage(partImage1, 70, 410, 100, 100); // <-- part 1 image
      ctx.drawImage(partImage2, 180, 410, 100, 100); // <-- part 2 image

      //box data row 1
      drawSmartText('124-9001-929, 124-9001-929', 100, 140, 250, 40, 20, 12); // <-- Order ID 1, 2 (Smart Text)

      drawSmartText('A123', 200, 180, 150, 50, 50, 12); // <-- Part Code 1 (Smart Text)
      drawSmartText('B8MES-49001929', 200, 230, 150, 50, 50, 12); // <-- Part Name 1 (Smart Text)
      await drawQRCode(labelData.part1.serial, 100, 180, 100); // <-- part 1 QR Code

      drawSmartText('A123', 100, 280, 150, 50, 50, 12); // <-- Part Code 2 (Smart Text)
      drawSmartText('B8MES-49001929', 100, 330, 150, 50, 50, 12); // <-- Part Name 2 (Smart Text)
      await drawQRCode(labelData.part2.serial, 250, 280, 100); // <-- part 2 QR Code

      drawLine(450, 140, 450, 380);
      drawBox(350, 140, 290, 40, 'SAP No');
      drawBox(350, 180, 290, 50, "Mat'l");
      drawBox(350, 230, 290, 50, 'Color');
      drawBox(350, 280, 290, 50, 'Producer');
      drawBox(350, 330, 290, 50, 'Date');
      drawBox(350, 380, 290, 150, '');
      drawText('Quantity (Unit)', 360, 400, '20px Arial', true);

      // box data row 2
      drawSmartText('49001929, 49001929', 450, 140, 190, 40, 25, 12); // <-- SAP No 1, 2 (Smart Text)

      drawSmartText('abasda', 450, 180, 190, 50, 25, 12); // <-- mat (Smart Text)
      drawSmartText('Black', 450, 230, 190, 50, 25, 12); // <-- Color (Smart Text)
      drawSmartText('2611061', 450, 280, 190, 50, 25, 12); // <-- Producer (Smart Text)
      drawSmartText('2023-05-01', 450, 330, 190, 50, 25, 12); // <-- Date (Smart Text)

      // Quantity
      drawSmartText('A: 10', 350, 400, 290, 55, 55, 12); // <-- quantity part 1
      drawSmartText('B: 10', 350, 455, 290, 55, 55, 12); // <-- quantity part 2

      ctx.font = 'bold 20px Arial';
      ctx.fillText('PCS.', 580, 520);
      ctx.font = 'bold 20px Arial';
      ctx.fillText('RoHS2', 360, 520);

      // Footer
      ctx.font = '12px Arial';
      ctx.fillText(labelData.part1.serial, 5, 545); // <-- QR Code text
      ctx.fillText(
        'F - PRO – 001 LABEL MES | Effective Date 03–05–2568 Rev.0',
        300,
        545,
      );
    }

    // วาดทันทีที่โหลดหน้า
    await drawLabel();

    return canvas.toBuffer('image/png');
  }

  private async loadImage(buffer: Buffer): Promise<any> {
    const { loadImage } = await import('canvas');
    return loadImage(buffer);
  }
}
