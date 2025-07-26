import { Injectable } from '@nestjs/common';
import { createCanvas, CanvasRenderingContext2D, loadImage } from 'canvas';
import path from 'path';
import * as fs from 'fs';

import * as QRCode from 'qrcode';
import { ProductionRecord } from 'src/schema/production-record.schema';
import e from 'express';
import { FileClientService } from 'src/shared/services/file-client/file-client.service';
// import { CoProductRecord } from '../schemas/co-product-record.schema';
import { labelData } from '../../production/dto/production-reccord.dto';
import { GenerateLabelDto, LabelDataDto } from '../dto/generate-label.dto';
import { CreateLabelRequest, LabelData } from 'src/shared/interface/label-data';
import { formatDateForLabel } from 'src/shared/utils/date.utils';

@Injectable()
export class LabelGeneratorService {
  constructor(private readonly fileClientService: FileClientService) {}
  //for 1 part
  async generate1PartLabel(labelDataDto: LabelDataDto): Promise<Buffer> {
    const canvas = createCanvas(640, 550);
    const ctx = canvas.getContext('2d');
    const iconImage = 'public/icon/Icon.png';

    const labelData = this.prepareLabelData(labelDataDto);

    const tagNo = labelData.part1.serial
      ? parseInt(labelData.part1.serial.split('-')[2] || '0000')
      : 0;

    const drawLabel = async () => {
      // Utils
      const drawText = (text, x, y, font = '16px Arial', bold = true) => {
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
      // ctx.drawImage(iconImage, 5, 5, 50, 50);
      await this.drawImage(iconImage, 5, 5, 50, 50, ctx);
      drawLine(65, 0, 65, 50);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('MES B8', 75, 30);
      ctx.font = 'bold 17px Arial';
      ctx.fillText('Manufacturing Execution System B8', 75, 50);

      this.drawCenteredText(
        tagNo.toString(),
        560,
        20,
        60,
        40,
        '50px Arial',
        true,
        ctx,
      ); // <-- label number

      drawText('Model -', 520, 90, '20px Arial', true); // <-- model
      drawBox(0, 60, 640, 40, `Customer Name : ${labelData.customer}`); // <-- customer name

      // Boxes
      drawLine(100, 100, 100, 380);
      // drawBox(0, 100, 640, 40, `Supplier    ${labelData.supplier}`);
      drawBox(0, 100, 640, 40, `Supplier    SNC SERENITY CO., LTD.`);
      drawBox(0, 140, 350, 40, `Order ID`);

      drawBox(0, 180, 350, 100, '');
      drawText('Part', 5, 220, '25px Arial', true);
      drawText('Code', 5, 245, '25px Arial', true);

      drawBox(0, 280, 350, 100, '');
      drawText('Part', 5, 320, '25px Arial', true);
      drawText('Name', 5, 345, '25px Arial', true);

      drawBox(0, 380, 350, 150, '');
      drawText('Picture of part', 5, 400, '20px Arial', true);

      await this.drawImage(
        labelData.part1.partImage ?? '',
        40,
        410,
        100,
        100,
        ctx,
      );

      await this.drawQRCode(labelData.part1.serial, 200, 380, 150, ctx); // <-- part 1 QR Code

      //box data row 1
      this.drawSmartText(
        labelData.part1.orderId,
        100,
        140,
        250,
        40,
        25,
        12,
        ctx,
      ); // <-- Order ID (Smart Text)
      this.drawSmartText(labelData.part1.code, 100, 180, 250, 100, 60, 12, ctx); // <-- Part Code (Smart Text)
      this.drawSmartText(labelData.part1.name, 100, 280, 250, 100, 60, 12, ctx); // <-- Part Name (Smart Text)

      drawLine(450, 140, 450, 380);
      drawBox(350, 140, 290, 40, 'SAP No');
      drawBox(350, 180, 290, 50, "Mat'l");
      drawBox(350, 230, 290, 50, 'Color');
      drawBox(350, 280, 290, 50, 'Producer');
      drawBox(350, 330, 290, 50, 'Date');
      drawBox(350, 380, 290, 150, '');
      drawText('Quantity (Unit)', 360, 400, '20px Arial', true);

      // box data row 2
      this.drawSmartText(labelData.part1.sapNo, 450, 140, 190, 40, 20, 12, ctx); // <-- SAP No (Smart Text)

      this.drawSmartText(labelData.mat, 450, 180, 190, 50, 25, 12, ctx); // <-- mat (Smart Text)
      this.drawSmartText(labelData.color, 450, 230, 190, 50, 25, 12, ctx); // <-- Color (Smart Text)
      this.drawSmartText(labelData.producer, 450, 280, 190, 50, 25, 12, ctx); // <-- Producer (Smart Text)
      this.drawSmartText(
        formatDateForLabel(labelData.date),
        450,
        330,
        190,
        50,
        25,
        12,
        ctx,
      ); // <-- Date (Smart Text)

      // Quantity
      this.drawCenteredText(
        labelData.part1.quantity.toString(),
        470,
        440,
        50,
        50,
        '95px Arial',
        true,
        ctx,
      ); // <-- quantity

      ctx.font = 'bold 20px Arial';
      ctx.fillText('PCS.', 580, 520);
      ctx.font = 'bold 20px Arial';
      ctx.fillText('RoHS2', 360, 520);

      // Footer
      ctx.font = 'bold 12px Arial';
      ctx.fillText(labelData.part1.serial, 5, 545); // <-- QR Code text
      ctx.fillText(
        'F - PRO – 001 LABEL MES | Effective Date 03–05–2568 Rev.0',
        290,
        545,
      );
    };

    // วาดทันทีที่โหลดหน้า
    await drawLabel();

    return canvas.toBuffer('image/png');
  }
  //for 2 part
  async generate2PartLabel(labelDataDto: LabelDataDto): Promise<Buffer> {
    const canvas = createCanvas(640, 550);
    const ctx = canvas.getContext('2d');
    const iconImage = 'public/icon/Icon.png';

    if (!labelDataDto.part2) {
      throw new Error('Part2 data is required for 2-part label');
    }

    const tagNo = labelDataDto.part1.serial
      ? parseInt(labelDataDto.part1.serial.split('-')[2] || '0000')
      : 0;

    const labelData = this.prepareLabelData(labelDataDto);

    const drawLabel = async () => {
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

      await this.drawImage(iconImage, 5, 5, 50, 50, ctx);
      drawLine(65, 0, 65, 50);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('MES B8', 75, 30);
      ctx.font = 'bold 17px Arial';
      ctx.fillText('Manufacturing Execution System B8', 75, 50);

      this.drawCenteredText(
        tagNo.toString(),
        560,
        20,
        60,
        40,
        '50px Arial',
        true,
        ctx,
      ); // <-- label number

      drawText('Model', 520, 90, '20px Arial', true);
      drawBox(0, 60, 640, 40, `Customer Name : ${labelData.customer}`); // <-- customer name

      // Boxes
      drawLine(100, 100, 100, 380);
      drawBox(0, 100, 640, 40, `Supplier    SNC SERENITY CO., LTD.`);
      drawBox(0, 140, 350, 40, `Order ID`);

      drawBox(0, 180, 350, 50, 'Part Code');
      drawBox(0, 230, 350, 50, 'Part Name');

      drawBox(0, 280, 350, 50, 'Part Code');
      drawBox(0, 330, 350, 50, 'Part Name');

      drawBox(0, 380, 350, 150, '');
      drawText('Picture of part', 5, 400, '20px Arial', true);
      await this.drawImage(
        labelData.part1.partImage ?? '',
        70,
        410,
        100,
        100,
        ctx,
      ); // <-- part 1 image
      await this.drawImage(
        labelData.part2.partImage ?? '',
        180,
        410,
        100,
        100,
        ctx,
      ); // <-- part 2 image

      //box data row 1
      this.drawSmartText(
        `${labelData.part1.orderId}, ${labelData.part2.orderId}`,
        100,
        140,
        250,
        40,
        20,
        12,
        ctx,
      ); // <-- Order ID 1, 2 (Smart Text)

      this.drawSmartText(labelData.part1.code, 200, 180, 150, 50, 50, 12, ctx); // <-- Part Code 1 (Smart Text)
      this.drawSmartText(labelData.part1.name, 200, 230, 150, 50, 50, 12, ctx); // <-- Part Name 1 (Smart Text)
      await this.drawQRCode(labelData.part1.serial, 100, 180, 100, ctx); // <-- part 1 QR Code

      this.drawSmartText(labelData.part2.code, 100, 280, 150, 50, 50, 12, ctx); // <-- Part Code 2 (Smart Text)
      this.drawSmartText(labelData.part2.name, 100, 330, 150, 50, 50, 12, ctx); // <-- Part Name 2 (Smart Text)
      await this.drawQRCode(labelData.part2.serial, 250, 280, 100, ctx); // <-- part 2 QR Code

      drawLine(450, 140, 450, 380);
      drawBox(350, 140, 290, 40, 'SAP No');
      drawBox(350, 180, 290, 50, "Mat'l");
      drawBox(350, 230, 290, 50, 'Color');
      drawBox(350, 280, 290, 50, 'Producer');
      drawBox(350, 330, 290, 50, 'Date');
      drawBox(350, 380, 290, 150, '');
      drawText('Quantity (Unit)', 360, 400, '20px Arial', true);

      // box data row 2
      this.drawSmartText(
        `${labelData.part1.sapNo}, ${labelData.part2.sapNo}`,
        450,
        140,
        190,
        40,
        25,
        12,
        ctx,
      ); // <-- SAP No 1, 2 (Smart Text)

      this.drawSmartText(labelData.mat, 450, 180, 190, 50, 25, 12, ctx); // <-- mat (Smart Text)
      this.drawSmartText(labelData.color, 450, 230, 190, 50, 25, 12, ctx); // <-- Color (Smart Text)
      this.drawSmartText(labelData.producer, 450, 280, 190, 50, 25, 12, ctx); // <-- Producer (Smart Text)
      this.drawSmartText(
        formatDateForLabel(labelData.date),
        450,
        330,
        190,
        50,
        25,
        12,
        ctx,
      ); // <-- Date (Smart Text)

      // Quantity
      this.drawSmartText(
        `A: ${labelData.part1.quantity}`,
        350,
        400,
        290,
        60,
        70,
        12,
        ctx,
      ); // <-- quantity part 1
      this.drawSmartText(
        `B: ${labelData.part2.quantity}`,
        350,
        455,
        290,
        60,
        70,
        12,
        ctx,
      ); // <-- quantity part 2

      ctx.font = 'bold 20px Arial';
      ctx.fillText('PCS.', 580, 520);
      ctx.font = 'bold 20px Arial';
      ctx.fillText('RoHS2', 360, 520);

      // Footer
      ctx.font = 'bold 12px Arial';
      ctx.fillText(labelData.part1.serial, 5, 545); // <-- QR Code text
      ctx.fillText(
        'F - PRO – 001 LABEL MES | Effective Date 03–05–2568 Rev.0',
        300,
        545,
      );
    };

    // วาดทันทีที่โหลดหน้า
    await drawLabel();

    return canvas.toBuffer('image/png');
  }

  async generateAndSaveLabel(
    labelType: string,
    labelDataDto: LabelDataDto,
  ): Promise<{ buffer: Buffer; filePath: string }> {
    try {
      // Generate label buffer ตาม type
      const buffer = await this.generateLabelByType(labelType, labelDataDto);

      // สร้างชื่อไฟล์และ path
      const timestamp = Date.now();

      const filename = `label_${labelType}_${timestamp}.png`;

      // อัพโหลดไปยัง file service
      const uploadResult = await this.saveLabelBuffer(buffer, filename);

      console.log('Label saved successfully:', uploadResult);

      return {
        buffer,
        filePath: uploadResult,
      };
    } catch (error) {
      console.error('Error in generateAndSaveLabel:', error);
      throw new Error(
        `Failed to generate and save label: ${(error as Error).message}`,
      );
    }
  }

  // Master method ที่เลือก generator ตาม label type (แค่ 2 แบบ)
  async generateLabelByType(
    labelType: string,
    labelData: LabelDataDto,
  ): Promise<Buffer> {
    switch (labelType) {
      case '1_part':
      case 'co_product_separate': // ใช้ 1_part template
        return await this.generate1PartLabel(labelData);

      case '2_part':
      case 'co_product_combined': // ใช้ 2_part template
        return await this.generate2PartLabel(labelData);

      default:
        throw new Error(`Unsupported label type: ${labelType}`);
    }
  }

  // Method สำหรับ generate แบบไม่ save (ใช้สำหรับ preview)
  async generateLabelOnly(
    labelType: string,
    labelData: LabelData,
  ): Promise<Buffer> {
    return await this.generateLabelByType(labelType, labelData);
  }

  // Method สำหรับ save buffer ที่มีอยู่แล้ว
  async saveLabelBuffer(
    buffer: Buffer,
    customFilename?: string,
  ): Promise<string> {
    try {
      const imagePath = 'mes/b8/label';
      const timestamp = Date.now();
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const filename =
        customFilename || `label_${year}-${month}-${day}_${timestamp}.png`;
      // const folderPath = `labels-${year}-${month}-${day}`;

      const mockFile: Express.Multer.File = {
        buffer,
        originalname: filename,
        mimetype: 'image/png',
        size: buffer.length,
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: filename,
        path: '',
        stream: null,
      };

      const uploadResult = await this.fileClientService.uploadFile(
        mockFile,
        imagePath,
        filename,
      );

      const filePath = uploadResult.data[0].url;

      return filePath;
    } catch (error) {
      console.error('Error saving label buffer:', error);
      throw new Error(
        `Failed to save label buffer: ${(error as Error).message}`,
      );
    }
  }

  // Private Methods
  private async drawImage(
    imagePath: string,
    x: number,
    y: number,
    width: number,
    height: number,
    ctx: CanvasRenderingContext2D,
  ): Promise<void> {
    const image = await this.loadImageSafe(imagePath);

    if (image) {
      ctx.drawImage(image, x, y, width, height);
    } else {
      console.log(`Skipping image draw for: ${imagePath}`);
    }
  }

  private async drawQRCode(
    qrData: string,
    x: number,
    y: number,
    size: number = 100,
    ctx: CanvasRenderingContext2D,
  ): Promise<void> {
    try {
      const qrBuffer = await QRCode.toBuffer(qrData, {
        width: size,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      const qrImage = await this.loadImageSafe(qrBuffer);
      ctx.drawImage(qrImage, x, y, size, size);
    } catch (error) {
      console.error('QR Code generation error:', error);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, size, size);

      ctx.fillStyle = '#666666';
      ctx.font = 'bold 12px Arial';
      const text = 'QR ERROR';
      const textWidth = ctx.measureText(text).width;
      ctx.fillText(text, x + (size - textWidth) / 2, y + size / 2);
    }
  }

  private drawCenteredText(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    font: string = '20px Arial',
    bold: boolean = false,
    ctx: CanvasRenderingContext2D,
  ): void {
    ctx.font = bold ? `bold ${font}` : font;

    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = parseInt(font);

    const centerX = x + width / 2 - textWidth / 2;
    const centerY = y + height / 2 + textHeight / 4;

    ctx.fillText(text, centerX, centerY);
  }

  private drawSmartText(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    maxFontSize: number = 20,
    minFontSize: number = 10,
    ctx: CanvasRenderingContext2D,
  ): void {
    if (!text) return;

    const padding = 5;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;

    let fontSize = maxFontSize;
    let lines = [];
    let totalHeight = 0;

    for (fontSize = maxFontSize; fontSize >= minFontSize; fontSize--) {
      ctx.font = `bold ${fontSize}px Arial`;
      lines = this.wrapText(text, availableWidth, ctx);
      totalHeight = lines.length * (fontSize * 1.2);

      if (totalHeight <= availableHeight) {
        break;
      }
    }

    const startY = y + padding + (availableHeight - totalHeight) / 2 + fontSize;

    ctx.fillStyle = '#000000';
    ctx.font = `bold ${fontSize}px Arial`;

    lines.forEach((line, index) => {
      const lineY = startY + index * fontSize * 1.2;
      const textWidth = ctx.measureText(line).width;
      const centerX = x + padding + (availableWidth - textWidth) / 2;
      ctx.fillText(line, centerX, lineY);
    });
  }

  private wrapText(
    text: string,
    maxWidth: number,
    ctx: CanvasRenderingContext2D,
  ): string[] {
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
          lines.push(...this.breakLongWord(word, maxWidth, ctx));
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private breakLongWord(
    word: string,
    maxWidth: number,
    ctx: CanvasRenderingContext2D,
  ): string[] {
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

  private async loadImageSafe(source: string | Buffer): Promise<any> {
    try {
      const { loadImage } = await import('canvas');

      if (typeof source === 'string' && !source && source == '') {
        console.warn('Invalid image path');
        return null;
      }

      const image = await loadImage(source);
      return image;
    } catch (error) {
      console.error('Error loading image:', (error as Error).message);
      return null;
    }
  }

  private prepareLabelData(labelDataDto: LabelDataDto): LabelData {
    const defaultImage = '';
    const today = new Date().toISOString().split('T')[0];

    return {
      labelNo: labelDataDto?.labelNo || '1',
      customer: labelDataDto?.customer || 'Unknown Customer',
      supplier: labelDataDto?.supplier || 'Unknown Supplier',
      mat: labelDataDto?.mat || 'Unknown Material',
      color: labelDataDto?.color || 'Unknown Color',
      producer: labelDataDto?.producer || 'Unknown Producer',
      date: labelDataDto?.date || today,

      part1: {
        orderId: labelDataDto?.part1?.orderId || 'DEFAULT-ORDER',
        sapNo: labelDataDto?.part1?.sapNo || 'DEFAULT-SAP',
        code: labelDataDto?.part1?.code || 'DEFAULT-CODE',
        name: labelDataDto?.part1?.name || 'Default Part',
        quantity: labelDataDto?.part1?.quantity || 1,
        serial: labelDataDto?.part1?.serial || 'DEFAULT-SERIAL',
        partImage: labelDataDto?.part1?.partImage || defaultImage,
      },

      part2: labelDataDto?.part2
        ? {
            orderId: labelDataDto.part2.orderId || 'DEFAULT-ORDER-2',
            sapNo: labelDataDto.part2.sapNo || 'DEFAULT-SAP-2',
            code: labelDataDto.part2.code || 'DEFAULT-CODE-2',
            name: labelDataDto.part2.name || 'Default Part 2',
            quantity: labelDataDto.part2.quantity || 1,
            serial: labelDataDto.part2.serial || 'DEFAULT-SERIAL-2',
            partImage: labelDataDto.part2.partImage || defaultImage,
          }
        : undefined,
    };
  }
}
