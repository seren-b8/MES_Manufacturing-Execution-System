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

    // Utils
    const drawText = (
      text: string,
      x: number,
      y: number,
      font = '16px Arial',
      bold = false,
    ) => {
      ctx.font = bold ? `bold ${font}` : font;
      ctx.fillText(text, x, y);
    };

    const drawBox = (
      x: number,
      y: number,
      w: number,
      h: number,
      label: string,
      value: string,
      labelBold = false,
      valueBold = true,
    ) => {
      ctx.strokeRect(x, y, w, h);
      drawText(label, x + 5, y + 15, '12px Arial', labelBold);
      drawText(value, x + 5, y + 35, '16px Arial', valueBold);
    };

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 640, 550);

    // Header
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('MES B8', 10, 30);
    ctx.font = '14px Arial';
    ctx.fillText('Manufacturing Execution System B8', 10, 50);

    // Customer Row
    drawText('Customer Name :', 10, 75);
    drawText('DAIKIN COMPRESSOR', 150, 75, '14px Arial', true);
    drawText('Model –', 500, 75);

    drawText('Supplier', 10, 100);
    drawText('Serenity', 100, 100, '14px Arial', true);

    // Left Column
    drawBox(10, 110, 300, 60, 'Order ID', '1650009038');
    drawBox(10, 170, 300, 60, 'Part Code', '2PD04462/1 – 1');
    drawBox(10, 230, 300, 60, 'Part Name', 'Insulator B');

    // Right Column
    drawBox(320, 110, 300, 60, 'SAP No', '49001929');
    drawBox(320, 170, 300, 60, 'Mat’l', 'LIQUID CRYSTAL');
    drawBox(320, 230, 300, 60, 'Color', 'NATURAL');

    drawBox(320, 290, 300, 60, 'Producer', '1066404016');
    drawBox(320, 350, 300, 60, 'Date', '27/06/2025');

    // Picture of Part + Quantity Header
    drawText('Picture of Part', 10, 430);
    drawText('Quantity (Unit)', 370, 430);

    // // Load QR image from file
    // const imagePath = path(__dirname, '..', '..', 'assets', '1part.png');
    // const image = await loadImage(fs.readFileSync(imagePath));
    // ctx.drawImage(image, 10, 440, 120, 120);

    const qrData = 'MES-B8-2PD04462/1-20250627';
    const qrBuffer = await QRCode.toBuffer(qrData, {
      width: 70,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    const qrImage = await this.loadImage(qrBuffer);

    ctx.drawImage(qrImage, 100, 440, 70, 70);

    // Quantity
    ctx.font = 'bold 60px Arial';
    ctx.fillText('70', 400, 500);
    ctx.font = '16px Arial';
    ctx.fillText('PCS.', 540, 500);
    ctx.fillText('RoHS2', 400, 530);

    // Footer
    ctx.font = '12px Arial';
    ctx.fillText(
      'B8MES | OK2EBB5C927–6QLhOOTna7–4 (1/1)PRO –001 LABEL MES | Effective Date 03–05–2568 Rev.0',
      10,
      545,
    );

    return canvas.toBuffer('image/png');
  }

  private async loadImage(buffer: Buffer): Promise<any> {
    const { loadImage } = await import('canvas');
    return loadImage(buffer);
  }
}
