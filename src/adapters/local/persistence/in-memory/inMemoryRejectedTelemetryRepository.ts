import type { RejectedRecord } from "../../../../core/telemetry/telemetryProcessingTypes";
import type { RejectedTelemetryRepository } from "../../../../ports/persistence/rejectedTelemetryRepository";

export class InMemoryRejectedTelemetryRepository implements RejectedTelemetryRepository {
  private readonly records: RejectedRecord[] = [];

  async saveBatch(records: RejectedRecord[]): Promise<void> {
    this.records.push(...records);
  }

  all(): RejectedRecord[] {
    return [...this.records];
  }
}
