// src/shared/shared.module.ts

import { Module } from '@nestjs/common';
import { SqlService } from './services/sql.service';

@Module({
  providers: [SqlService],
  exports: [SqlService],
})
export class SharedModule {}
