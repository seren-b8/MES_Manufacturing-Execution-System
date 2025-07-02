import { Injectable } from '@nestjs/common';
import { createCanvas, CanvasRenderingContext2D, loadImage } from 'canvas';
import path from 'path';
import * as fs from 'fs';

import * as QRCode from 'qrcode';
import { ProductionRecord } from 'src/schema/production-record.schema';
import e from 'express';
// import { CoProductRecord } from '../schemas/co-product-record.schema';

@Injectable()
export class LabelGeneratorService {
  async generate1PartLabel(): Promise<Buffer> {
    const canvas = createCanvas(640, 550);
    const ctx = canvas.getContext('2d');
    const iconImage = 'public/icon/Icon.png';

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
        quantity: 10000,
        serial: 'B8MES|NG2EBB5C312-6QLZuGcXSX-3',
        partImage: 'public/icon/Icon.png',
      },
    };

    // Function สำหรับวาดรูปแบบปลอดภัย

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

      this.drawCenteredText('1', 560, 20, 60, 40, '50px Arial', true, ctx); // <-- label number

      drawText('Model -', 520, 90, '20px Arial', true); // <-- model
      drawBox(0, 60, 640, 40, `Customer Name : ${labelData.customer}`); // <-- customer name

      // Boxes
      drawLine(100, 100, 100, 380);
      drawBox(0, 100, 640, 40, `Supplier    ${labelData.supplier}`);
      drawBox(0, 140, 350, 40, `Order ID`);

      drawBox(0, 180, 350, 100, '');
      drawText('Part', 5, 220, '25px Arial', true);
      drawText('Code', 5, 245, '25px Arial', true);

      drawBox(0, 280, 350, 100, '');
      drawText('Part', 5, 320, '25px Arial', true);
      drawText('Name', 5, 345, '25px Arial', true);

      drawBox(0, 380, 350, 150, '');
      drawText('Picture of part', 5, 400, '20px Arial', true);

      await this.drawImage(labelData.part1.partImage, 40, 410, 100, 100, ctx);

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
      this.drawSmartText(labelData.date, 450, 330, 190, 50, 25, 12, ctx); // <-- Date (Smart Text)

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

  async generate2PartLabel(): Promise<Buffer> {
    const canvas = createCanvas(640, 550);
    const ctx = canvas.getContext('2d');
    const iconImage = 'public/icon/Icon.png';

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
        quantity: 10,
        serial: 'B8MES|NG2EBB5C312-6QLZuGcXSX-3',
        partImage: 'public/icon/Icon.png', // <-- part 1 image path
      },
      part2: {
        orderId: '124-9001-930',
        sapNo: '49001930',
        code: '2PD04462/1-2',
        name: 'B8MES-4901',
        quantity: 10,
        serial: 'B8MES|NG2EBB5C312-6QLZuGcXSX-4',
        partImage: 'public/icon/Icon.png', // <-- part 2 image path
      },
    };

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
        labelData.labelNo,
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
      drawBox(0, 100, 640, 40, `Supplier    ${labelData.supplier}`);
      drawBox(0, 140, 350, 40, `Order ID`);

      drawBox(0, 180, 350, 50, 'Part Code');
      drawBox(0, 230, 350, 50, 'Part Name');

      drawBox(0, 280, 350, 50, 'Part Code');
      drawBox(0, 330, 350, 50, 'Part Name');

      drawBox(0, 380, 350, 150, '');
      drawText('Picture of part', 5, 400, '20px Arial', true);
      await this.drawImage(labelData.part1.partImage, 70, 410, 100, 100, ctx); // <-- part 1 image
      await this.drawImage(labelData.part2.partImage, 180, 410, 100, 100, ctx); // <-- part 2 image

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
      this.drawSmartText(labelData.date, 450, 330, 190, 50, 25, 12, ctx); // <-- Date (Smart Text)

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
      ctx.font = '12px Arial';
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
      ctx.font = '12px Arial';
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
    ctx.font = `${fontSize}px Arial`;

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

      if (typeof source === 'string' && !source) {
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
}
