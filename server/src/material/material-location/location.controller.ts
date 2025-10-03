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
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { LocationService } from './location.service';

import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../../auth/guard/roles.guard';
import { Roles } from '../../auth/decorator/roles.decorator';
import { Role } from 'src/auth/enum/roles.enum';
import { QueryLocationDto } from './dto/query-location.dto';

@Controller('material-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}
  /**
   * Get all locations with optional filters
   * @route GET /material-locations
   */
  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryLocationDto) {
    return this.locationService.findAll(query);
  }

  /**
   * Get location summary statistics
   * @route GET /material-locations/summary
   */
  @Get('summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getLocationSummary() {
    return this.locationService.getLocationSummary();
  }

  /**
   * Get all warehouse locations
   * @route GET /material-locations/warehouses
   */
  @Get('warehouses')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getWarehouses() {
    return this.locationService.getWarehouses();
  }

  /**
   * Get all production area locations
   * @route GET /material-locations/production-areas
   */
  @Get('production-areas')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getProductionAreas() {
    return this.locationService.getProductionAreas();
  }

  /**
   * Get all machine locations
   * @route GET /material-locations/machines
   */
  @Get('machines')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getMachineLocations() {
    return this.locationService.getMachineLocations();
  }

  /**
   * Get locations that have positions
   * @route GET /material-locations/with-positions
   */
  @Get('with-positions')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getLocationsWithPositions() {
    return this.locationService.getLocationsWithPositions();
  }

  /**
   * Get locations by type
   * @route GET /material-locations/by-type/:type
   */
  @Get('by-type/:type')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findByType(@Param('type') type: string) {
    return this.locationService.findByType(type);
  }

  /**
   * Get location by code
   * @route GET /material-locations/by-code/:code
   */
  @Get('by-code/:code')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findByCode(@Param('code') code: string) {
    return this.locationService.findByCode(code);
  }

  /**
   * Get all materials in a location
   * @route GET /material-locations/:code/materials
   */
  @Get(':code/materials')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getMaterialsInLocation(@Param('code') locationCode: string) {
    return this.locationService.getMaterialsInLocation(locationCode);
  }

  /**
   * Get location utilization statistics
   * @route GET /material-locations/:code/utilization
   */
  @Get(':code/utilization')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getLocationUtilization(@Param('code') locationCode: string) {
    return this.locationService.getLocationUtilization(locationCode);
  }

  /**
   * Get all positions in a location
   * @route GET /material-locations/:code/positions
   */
  @Get(':code/positions')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getPositionsInLocation(@Param('code') locationCode: string) {
    return this.locationService.getPositionsInLocation(locationCode);
  }

  /**
   * Get available positions in a location
   * @route GET /material-locations/:code/available-positions
   */
  @Get(':code/available-positions')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getAvailablePositions(@Param('code') locationCode: string) {
    return this.locationService.getAvailablePositions(locationCode);
  }

  /**
   * Get location detail by ID
   * @route GET /material-locations/:id
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.locationService.findOne(id);
  }
}
