import type { TelemetryRecord } from "../core/telemetry/telemetryRecord";

export interface TelemetryRepository {
  saveBatch(records: TelemetryRecord[]): Promise<void>;
}
