import type { RejectedRecord } from "../../../core/telemetry/telemetryTypes";
import type { RejectedRecordRepository } from "../../../ports/persistence/rejectedRecordRepository";

export class InMemoryRejectedRecordRepository implements RejectedRecordRepository {
  private readonly records: RejectedRecord[] = [];

  async saveBatch(records: RejectedRecord[]): Promise<void> {
    this.records.push(...records);
  }

  all(): RejectedRecord[] {
    return [...this.records];
  }
}
