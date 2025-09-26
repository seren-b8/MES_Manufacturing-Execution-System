// src/material/material-location/location.controller.ts
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
import { LocationService } from './location.service';
import { CreateLocationDto } from '../dto/create-location.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { GeneratePositionCodeDto } from '../dto/position-code.dto';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';

@Controller('locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationService.create(createLocationDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findAll() {
    return this.locationService.findAll();
  }

  @Get('warehouses')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findWarehouses() {
    return this.locationService.findWarehouses();
  }

  @Get('with-positions')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findWithPositions() {
    return this.locationService.findWithPositions();
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getLocationStats() {
    return this.locationService.getLocationStats();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findById(@Param('id') id: string) {
    return this.locationService.findById(id);
  }

  @Get('code/:code')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findByCode(@Param('code') code: string) {
    return this.locationService.findByCode(code);
  }

  @Get('type/:type')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findByType(@Param('type') type: string) {
    return this.locationService.findByType(type);
  }

  @Get('parent/:parentId/children')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async findByParent(@Param('parentId') parentId: string) {
    return this.locationService.findByParent(parentId);
  }

  @Get(':id/materials')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async getMaterialsInLocation(@Param('id') id: string) {
    return this.locationService.getMaterialsInLocation(id);
  }

  @Post('generate-position-code')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  async generatePositionCode(
    @Body() generatePositionCodeDto: GeneratePositionCodeDto,
  ) {
    return this.locationService.generatePositionCode(generatePositionCodeDto);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.locationService.update(id, updateLocationDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async delete(@Param('id') id: string) {
    return this.locationService.delete(id);
  }
}
