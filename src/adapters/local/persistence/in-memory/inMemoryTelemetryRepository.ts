import type { ProcessedRecord } from "../../../../core/telemetry/telemetryProcessingTypes";
import type { TelemetryRepository } from "../../../../ports/persistence/telemetryRepository";

export class InMemoryTelemetryRepository implements TelemetryRepository {
  private readonly records: ProcessedRecord[] = [];

  async saveBatch(records: ProcessedRecord[]): Promise<void> {
    this.records.push(...records);
  }

  all(): ProcessedRecord[] {
    return [...this.records];
  }
}
