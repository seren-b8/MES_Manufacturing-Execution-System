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
} from '@nestjs/common';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { LabelService } from './label.service';
import { LabelGeneratorService } from './services/label-generator.service';

@Controller('label')
// @UseGuards(JwtAuthGuard, RolesGuard)
export class LabelController {
  constructor(private readonly labelGeneratorService: LabelGeneratorService) {}

  //   @Get('type/:type')
  //   @Roles(Role.ADMIN, Role.USER)
  //   findByType(@Param('type') type: string) {
  //     return this.labelService.find(type);
  //   }

  @Get('preview')
  async previewLabel() // @Param('type') type: "1_part"| "2_part",
  // @Query() mockData: any,
  : Promise<any> {
    const type: '1_part' | '2_part' = '2_part'; // or "1_part" based on your requirement
    const buffer = await this.labelGeneratorService
      .generate1PartLabel
      //   type, // or "2_part" based on your requirement
      //   //   mockData,
      ();

    return `
        <html>
          <head>
            <title>Label Preview</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .container { display: flex; gap: 20px; }
              .preview-box { border: 1px solid #ccc; padding: 15px; }
              h3 { margin-top: 0; }
              img { max-width: 300px; border: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <h2>Label Preview & Reference</h2>
            <div class="container">
              <div class="preview-box">
                <h3>Generated Preview</h3>
                <img src="data:image/png;base64,${buffer.toString('base64')}" />
              </div>
              <div class="preview-box">
                <h3>Reference Design</h3>
                <img src="/label-references/${'2part.png'}" />
                <p><em>Target design to match</em></p>
              </div>
            </div>
          </body>
        </html>
      `;
  }
}
