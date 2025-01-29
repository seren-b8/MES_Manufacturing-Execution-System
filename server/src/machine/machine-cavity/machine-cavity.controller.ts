import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MachineCavityService } from './machine-cavity.service';
import { ResponseFormat } from 'src/shared/interface';
import { MasterCavity } from 'src/shared/modules/schema/master-cavity.schema';
import {
  CreateFromPartsDto,
  CreateMasterCavityDto,
  UpdateMasterCavityDto,
} from '../dto/master-cavity.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

@Controller('machine-cavity')
@UseGuards(JwtAuthGuard)
export class MachineCavityController {
  constructor(private readonly machineCavityService: MachineCavityService) {}

  @Get()
  async findAll(@Query() query: any): Promise<ResponseFormat<MasterCavity>> {
    return this.machineCavityService.findAll(query);
  }

  @Post()
  async create(
    @Body() createDto: CreateMasterCavityDto,
  ): Promise<ResponseFormat<MasterCavity>> {
    return this.machineCavityService.create(createDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMasterCavityDto,
  ): Promise<ResponseFormat<MasterCavity>> {
    return this.machineCavityService.update(id, updateDto);
  }

  // @Delete(':id')
  // async remove(@Param('id') id: string): Promise<ResponseFormat<MasterCavity>> {
  //   return this.machineCavityService.remove(id);
  // }

  // @Post('from-parts')
  // async createFromParts(@Body() createFromPartsDto: CreateFromPartsDto) {
  //   const { material_numbers, ...cavityData } = createFromPartsDto;
  //   return await this.machineCavityService.createFromExistingPart(
  //     material_numbers,
  //     cavityData,
  //   );
  // }
}
