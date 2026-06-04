import type { RejectedTelemetryRecord } from "../../../core/telemetry/telemetryTypes";
import type { RejectedRecordRepository } from "../../../ports/persistence/rejectedRecordRepository";

export class InMemoryRejectedRecordRepository implements RejectedRecordRepository {
  private readonly records: RejectedTelemetryRecord[] = [];

  async saveBatch(records: RejectedTelemetryRecord[]): Promise<void> {
    this.records.push(...records);
  }

  all(): RejectedTelemetryRecord[] {
    return [...this.records];
  }
}
