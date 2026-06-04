import type {
  ProcessedTelemetryRecord,
  RejectedTelemetryRecord
} from "../../core/telemetry/telemetryTypes";
import type {
  RejectedRecordRepository,
  TelemetryRepository
} from "../../ports/telemetryRepository";

export class InMemoryTelemetryRepository implements TelemetryRepository {
  private readonly records: ProcessedTelemetryRecord[] = [];

  async saveBatch(records: ProcessedTelemetryRecord[]): Promise<void> {
    this.records.push(...records);
  }

  all(): ProcessedTelemetryRecord[] {
    return [...this.records];
  }
}

export class InMemoryRejectedRecordRepository implements RejectedRecordRepository {
  private readonly records: RejectedTelemetryRecord[] = [];

  async saveBatch(records: RejectedTelemetryRecord[]): Promise<void> {
    this.records.push(...records);
  }

  all(): RejectedTelemetryRecord[] {
    return [...this.records];
  }
}
