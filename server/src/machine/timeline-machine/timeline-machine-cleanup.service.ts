import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TimelineMachine } from 'src/schema/timeline-machine.schema';
import moment = require('moment-timezone');

export interface CleanupResult {
  machine_number: string;
  original_count: number;
  cleaned_count: number;
  removed_count: number;
  status_transitions: {
    from: string;
    to: string;
    timestamp: Date;
  }[];
}

export interface CleanupSummary {
  total_machines: number;
  total_original_records: number;
  total_cleaned_records: number;
  total_removed_records: number;
  processing_time_ms: number;
  results: CleanupResult[];
}
export interface CleanupOptions {
  machine_number?: string;
  date_range?: {
    start: string;
    end: string;
  };
  dry_run?: boolean;
  batch_size?: number;
}
@Injectable()
export class TimelineMachineCleanupService {
  private readonly logger = new Logger(TimelineMachineCleanupService.name);

  constructor(
    @InjectModel(TimelineMachine.name)
    private timelineMachineModel: Model<TimelineMachine>,
  ) {}

  async cleanupTimelineData(options: CleanupOptions): Promise<CleanupSummary> {
    const startTime = Date.now();
    const {
      machine_number,
      date_range,
      dry_run = true,
      batch_size = 1000,
    } = options;

    this.logger.log(`Starting timeline cleanup - Dry run: ${dry_run}`);

    // Build query filter
    const filter: any = {};
    if (machine_number) {
      filter.machine_number = machine_number;
    }
    if (date_range) {
      filter.createdAt = {
        $gte: moment(date_range.start)
          .tz('Asia/Bangkok')
          .startOf('day')
          .toDate(),
        $lte: moment(date_range.end).tz('Asia/Bangkok').endOf('day').toDate(),
      };
    }

    // Get distinct machine numbers
    const machineNumbers = await this.timelineMachineModel
      .distinct('machine_number', filter)
      .exec();

    this.logger.log(`Found ${machineNumbers.length} machines to process`);

    const results: CleanupResult[] = [];
    let totalOriginal = 0;
    let totalCleaned = 0;
    let totalRemoved = 0;

    // Process each machine
    for (const machineNum of machineNumbers) {
      try {
        const machineFilter = { ...filter, machine_number: machineNum };
        const result = await this.cleanupMachineData(
          machineFilter,
          dry_run,
          batch_size,
        );

        results.push(result);
        totalOriginal += result.original_count;
        totalCleaned += result.cleaned_count;
        totalRemoved += result.removed_count;

        this.logger.log(
          `Machine ${machineNum}: ${result.original_count} -> ${result.cleaned_count} records`,
        );
      } catch (error) {
        this.logger.error(`Error processing machine ${machineNum}:`, error);
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      total_machines: machineNumbers.length,
      total_original_records: totalOriginal,
      total_cleaned_records: totalCleaned,
      total_removed_records: totalRemoved,
      processing_time_ms: processingTime,
      results,
    };
  }

  private async cleanupMachineData(
    filter: any,
    dryRun: boolean,
    batchSize: number,
  ): Promise<CleanupResult> {
    // Get all records for this machine, sorted by timestamp
    const records = await this.timelineMachineModel
      .find(filter)
      .sort({ createdAt: 1 })
      .select('_id status createdAt')
      .lean()
      .exec();

    if (records.length === 0) {
      return {
        machine_number: filter.machine_number,
        original_count: 0,
        cleaned_count: 0,
        removed_count: 0,
        status_transitions: [],
      };
    }

    // Find records to keep
    const toKeep = this.identifyRecordsToKeep(records);
    const toRemove = records.filter(
      (record) => !toKeep.has(record._id.toString()),
    );

    // Track status transitions
    const transitions = this.identifyStatusTransitions(records);

    // Perform deletion if not dry run
    if (!dryRun && toRemove.length > 0) {
      await this.batchDelete(
        toRemove.map((r) => r._id),
        batchSize,
      );
    }

    return {
      machine_number: filter.machine_number,
      original_count: records.length,
      cleaned_count: toKeep.size,
      removed_count: toRemove.length,
      status_transitions: transitions,
    };
  }

  private identifyRecordsToKeep(records: any[]): Set<string> {
    const toKeep = new Set<string>();

    if (records.length === 0) return toKeep;

    // Always keep first record
    toKeep.add(records[0]._id.toString());

    // Always keep last record
    if (records.length > 1) {
      toKeep.add(records[records.length - 1]._id.toString());
    }

    // Find status change points
    for (let i = 1; i < records.length; i++) {
      const current = records[i];
      const previous = records[i - 1];

      // If status changed, keep both records
      if (current.status !== previous.status) {
        toKeep.add(previous._id.toString()); // Last record of old status
        toKeep.add(current._id.toString()); // First record of new status
      }
    }

    return toKeep;
  }

  private identifyStatusTransitions(
    records: any[],
  ): Array<{ from: string; to: string; timestamp: Date }> {
    const transitions = [];

    for (let i = 1; i < records.length; i++) {
      const current = records[i];
      const previous = records[i - 1];

      if (current.status !== previous.status) {
        transitions.push({
          from: previous.status,
          to: current.status,
          timestamp: current.createdAt,
        });
      }
    }

    return transitions;
  }

  private async batchDelete(
    idsToDelete: any[],
    batchSize: number,
  ): Promise<void> {
    this.logger.log(
      `Deleting ${idsToDelete.length} records in batches of ${batchSize}`,
    );

    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);

      try {
        await this.timelineMachineModel
          .deleteMany({
            _id: { $in: batch },
          })
          .exec();

        this.logger.log(
          `Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(idsToDelete.length / batchSize)}`,
        );
      } catch (error) {
        this.logger.error(
          `Error deleting batch starting at index ${i}:`,
          error,
        );
        throw error;
      }

      // Small delay between batches to not overwhelm the database
      if (i + batchSize < idsToDelete.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  async getCleanupPreview(options: CleanupOptions): Promise<CleanupSummary> {
    return this.cleanupTimelineData({ ...options, dry_run: true });
  }

  async executeCleanup(options: CleanupOptions): Promise<CleanupSummary> {
    return this.cleanupTimelineData({ ...options, dry_run: false });
  }

  // Utility method to estimate storage savings
  async estimateStorageSavings(options: CleanupOptions): Promise<{
    current_size_mb: number;
    estimated_size_mb: number;
    savings_mb: number;
    savings_percentage: number;
  }> {
    const preview = await this.getCleanupPreview(options);

    // Rough estimate: each record ≈ 100 bytes
    const avgRecordSize = 100;
    const currentSizeMB =
      (preview.total_original_records * avgRecordSize) / (1024 * 1024);
    const estimatedSizeMB =
      (preview.total_cleaned_records * avgRecordSize) / (1024 * 1024);
    const savingsMB = currentSizeMB - estimatedSizeMB;
    const savingsPercentage = (savingsMB / currentSizeMB) * 100;

    return {
      current_size_mb: Math.round(currentSizeMB * 100) / 100,
      estimated_size_mb: Math.round(estimatedSizeMB * 100) / 100,
      savings_mb: Math.round(savingsMB * 100) / 100,
      savings_percentage: Math.round(savingsPercentage * 100) / 100,
    };
  }
}
