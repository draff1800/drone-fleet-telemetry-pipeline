import type { ProcessedRecord } from "../../../core/telemetry/telemetryTypes";
import type { RecordRepository } from "../../../ports/persistence/telemetryRepository";

export class InMemoryRecordRepository implements RecordRepository {
  private readonly records: ProcessedRecord[] = [];

  async saveBatch(records: ProcessedRecord[]): Promise<void> {
    this.records.push(...records);
  }

  all(): ProcessedRecord[] {
    return [...this.records];
  }
}
