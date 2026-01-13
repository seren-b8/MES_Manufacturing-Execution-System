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
}
