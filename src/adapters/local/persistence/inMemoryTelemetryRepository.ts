import type { ProcessedTelemetryRecord } from "../../../core/telemetry/telemetryTypes";
import type { TelemetryRepository } from "../../../ports/persistence/telemetryRepository";

export class InMemoryTelemetryRepository implements TelemetryRepository {
  private readonly records: ProcessedTelemetryRecord[] = [];

  async saveBatch(records: ProcessedTelemetryRecord[]): Promise<void> {
    this.records.push(...records);
  }

  all(): ProcessedTelemetryRecord[] {
    return [...this.records];
  }
}
