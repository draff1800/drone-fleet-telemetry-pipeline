import type { TelemetryRecord } from "../../core/telemetry/telemetryRecord";
import type { TelemetryRepository } from "../../ports/telemetryRepository";

export class InMemoryTelemetryRepository implements TelemetryRepository {
  private readonly records: TelemetryRecord[] = [];

  async saveBatch(records: TelemetryRecord[]): Promise<void> {
    this.records.push(...records);
  }

  all(): TelemetryRecord[] {
    return [...this.records];
  }
}
