import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { PositionService } from './position.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Role } from 'src/auth/enum/roles.enum';
import { Roles } from 'src/auth/decorator/roles.decorator';

@Controller('material-positions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  /**
   * Get all positions (optionally filter by location)
   * @route GET /material-positions
   */
  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query('location_code') locationCode?: string) {
    return this.positionService.findAll(locationCode);
  }

  /**
   * Search positions by code
   * @route GET /material-positions/search
   */
  @Get('search')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async searchPositions(@Query('q') searchQuery: string) {
    if (!searchQuery) {
      return {
        status: 'error',
        message: 'Search query parameter "q" is required',
        data: [],
      };
    }
    return this.positionService.searchPositions(searchQuery);
  }

  /**
   * Get all available positions
   * @route GET /material-positions/available
   */
  @Get('available')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findAvailable(@Query('location_code') locationCode?: string) {
    return this.positionService.findAvailable(locationCode);
  }

  /**
   * Get all occupied positions
   * @route GET /material-positions/occupied
   */
  @Get('occupied')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findOccupied(@Query('location_code') locationCode?: string) {
    return this.positionService.findOccupied(locationCode);
  }

  /**
   * Get positions by shelf code
   * @route GET /material-positions/by-shelf/:shelfCode
   */
  @Get('by-shelf/:shelfCode')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findByShelf(
    @Param('shelfCode') shelfCode: string,
    @Query('location_code') locationCode?: string,
  ) {
    return this.positionService.findByShelf(shelfCode, locationCode);
  }

  /**
   * Get position by code
   * @route GET /material-positions/by-code/:code
   */
  @Get('by-code/:code')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findByCode(@Param('code') code: string) {
    return this.positionService.findByCode(code);
  }

  /**
   * Get materials in a position
   * @route GET /material-positions/:code/materials
   */
  @Get(':code/materials')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async getMaterialsInPosition(@Param('code') positionCode: string) {
    return this.positionService.getMaterialsInPosition(positionCode);
  }

  /**
   * Get position utilization
   * @route GET /material-positions/:code/utilization
   */
  @Get(':code/utilization')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getPositionUtilization(@Param('code') positionCode: string) {
    return this.positionService.getPositionUtilization(positionCode);
  }

  /**
   * Get position detail by ID
   * @route GET /material-positions/:id
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.positionService.findOne(id);
  }
}
