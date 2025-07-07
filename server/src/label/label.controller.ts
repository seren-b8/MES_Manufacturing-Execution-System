// src/printer/printer-devices.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { LabelService } from './label.service';
import { LabelGeneratorService } from './services/label-generator.service';
import { GenerateLabelDto, LabelDataDto } from './dto/generate-label.dto';

@Controller('label')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class LabelController {
  constructor(
    private readonly labelService: LabelService,
    private readonly labelGeneratorService: LabelGeneratorService,
  ) {}

  @Post('generate')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @UsePipes(new ValidationPipe({ transform: true }))
  async generateLabel(@Body() generateLabelDto: GenerateLabelDto) {
    console.log(generateLabelDto);
    return this.labelService.generateLabel(generateLabelDto);
  }

  @Post(':id/print')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async printLabel(@Param('id') jobId: string) {
    return this.labelService.printLabel(jobId);
  }

  @Post(':id/reprint')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async reprintLabel(@Param('id') originalJobId: string) {
    return this.labelService.reprintLabel(originalJobId);
  }

  @Get('jobs')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getLabelJobs(
    @Query('status') status?: string,
    @Query('printer_id') printerId?: string,
    @Query('is_reprint') isReprint?: boolean,
  ) {
    return this.labelService.getLabelJobs(status, printerId, isReprint);
  }

  @Get('jobs/:id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getLabelJob(@Param('id') jobId: string) {
    return this.labelService.getLabelJob(jobId);
  }

  @Delete('jobs/:id')
  @Roles(Role.ADMIN)
  async deleteLabelJob(@Param('id') jobId: string) {
    return this.labelService.deleteLabelJob(jobId);
  }

  @Get('preview')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async previewLabel(@Query() labelDataDto?: LabelDataDto) {
    console.log(labelDataDto);
    // ใช้ default data ถ้าไม่ได้ส่งมา
    const buffer =
      await this.labelGeneratorService.generate1PartLabel(labelDataDto);

    return `
      <html>
        <head>
          <title>Label Preview</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #f5f5f5;
            }
            .preview-container {
              text-align: center;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            img { 
              border: 1px solid #ddd; 
              border-radius: 4px;
              max-width: 100%;
            }
            .info {
              margin-top: 10px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="preview-container">
            <h2>Label Preview</h2>
            <img src="data:image/png;base64,${buffer.toString('base64')}" />
            <div class="info">
              Size: 640x550 pixels<br>
              Type: 1-Part Label
            </div>
          </div>
        </body>
      </html>
    `;
  }

  @Get('preview/2-part')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UsePipes(new ValidationPipe({ transform: true }))
  async preview2PartLabel(@Query() labelDataDto?: LabelDataDto) {
    const buffer =
      await this.labelGeneratorService.generate2PartLabel(labelDataDto);

    return `
      <html>
        <head>
          <title>2-Part Label Preview</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #f5f5f5;
            }
            .preview-container {
              text-align: center;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            img { 
              border: 1px solid #ddd; 
              border-radius: 4px;
              max-width: 100%;
            }
            .info {
              margin-top: 10px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="preview-container">
            <h2>2-Part Label Preview</h2>
            <img src="data:image/png;base64,${buffer.toString('base64')}" />
            <div class="info">
              Size: 640x550 pixels<br>
              Type: 2-Part Label
            </div>
          </div>
        </body>
      </html>
    `;
  }

  @Post('preview/custom')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UsePipes(new ValidationPipe({ transform: true }))
  async previewCustomLabel(@Body() labelDataDto: LabelDataDto) {
    const buffer =
      await this.labelGeneratorService.generate1PartLabel(labelDataDto);

    return {
      status: 'success',
      message: 'Preview generated successfully',
      data: [
        {
          image_base64: buffer.toString('base64'),
          content_type: 'image/png',
          size: buffer.length,
        },
      ],
    };
  }

  @Get('download/:jobId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async downloadLabel(
    @Param('jobId') jobId: string,
    @Query('format') format = 'png',
  ) {
    // Implementation for downloading label
    const job = await this.labelService.getLabelJob(jobId);

    if (job.status === 'success' && job.data.length > 0) {
      // ในการใช้งานจริง จะดึงไฟล์จาก file service หรือ generate ใหม่
      return {
        status: 'success',
        message: 'Label ready for download',
        data: [
          {
            download_url: `/file-service/${job.data[0].image_path}`,
            format: format,
            size: job.data[0].image_size,
          },
        ],
      };
    }

    throw new Error('Label job not found or not ready');
  }

  // Statistics endpoints
  @Get('stats/summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getLabelStatsSummary(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    try {
      const filter: any = {};

      if (startDate && endDate) {
        filter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      // Mock statistics - ในการใช้งานจริงจะคำนวณจาก database
      const stats = {
        total_jobs: await this.labelService.getLabelJobs(),
        printed_jobs: await this.labelService.getLabelJobs('printed'),
        failed_jobs: await this.labelService.getLabelJobs('failed'),
        reprint_jobs: await this.labelService.getLabelJobs(
          undefined,
          undefined,
          true,
        ),
      };

      return {
        status: 'success',
        message: 'Label statistics retrieved',
        data: [
          {
            total: stats.total_jobs.data.length,
            printed: stats.printed_jobs.data.length,
            failed: stats.failed_jobs.data.length,
            reprints: stats.reprint_jobs.data.length,
            success_rate:
              stats.total_jobs.data.length > 0
                ? (
                    (stats.printed_jobs.data.length /
                      stats.total_jobs.data.length) *
                    100
                  ).toFixed(2) + '%'
                : '0%',
          },
        ],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to get statistics',
        data: [],
      };
    }
  }

  @Get('stats/by-printer')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getLabelStatsByPrinter() {
    // Implementation for printer-wise statistics
    return {
      status: 'success',
      message: 'Printer statistics retrieved',
      data: [
        {
          // Mock data - implement actual aggregation
          printer_stats: 'Implementation needed',
        },
      ],
    };
  }

  @Get('health')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getHealthStatus() {
    try {
      // ตรวจสอบสถานะของ services ต่างๆ
      return {
        status: 'success',
        message: 'Label service is healthy',
        data: [
          {
            service: 'label-service',
            status: 'up',
            timestamp: new Date(),
            dependencies: {
              database: 'connected',
              file_service: 'connected',
              label_generator: 'ready',
            },
          },
        ],
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Service health check failed',
        data: [],
      };
    }
  }

  // @Get('preview')
  // async previewLabel() // @Param('type') type: "1_part"| "2_part",
  // // @Query() mockData: any,
  // : Promise<any> {
  //   const type: '1_part' | '2_part' = '2_part'; // or "1_part" based on your requirement
  //   const buffer = await this.labelGeneratorService
  //     .generate1PartLabel
  //     //   type, // or "2_part" based on your requirement
  //     //   //   mockData,
  //     ();

  //   return `
  //       <html>
  //         <head>
  //           <title>Label Preview</title>
  //           <style>
  //             body { font-family: Arial, sans-serif; margin: 20px; }
  //             .container { display: flex; gap: 20px; }
  //             .preview-box { border: 1px solid #ccc; padding: 15px; }
  //             h3 { margin-top: 0; }
  //             img { max-width: 300px; border: 1px solid #ddd; }
  //           </style>
  //         </head>
  //         <body>
  //           <h2>Label Preview & Reference</h2>
  //           <div class="container">
  //             <div class="preview-box">
  //               <h3>Generated Preview</h3>
  //               <img src="data:image/png;base64,${buffer.toString('base64')}" />
  //             </div>
  //             <div class="preview-box">
  //               <h3>Reference Design</h3>
  //               <img src="/label-references/${'2part.png'}" />
  //               <p><em>Target design to match</em></p>
  //             </div>
  //           </div>
  //         </body>
  //       </html>
  //     `;
  // }
}
