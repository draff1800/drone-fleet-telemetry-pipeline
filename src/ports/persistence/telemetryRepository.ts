import type { ProcessedTelemetryRecord } from "../../core/telemetry/telemetryTypes";

export interface TelemetryRepository {
  saveBatch(records: ProcessedTelemetryRecord[]): Promise<void>;
}
