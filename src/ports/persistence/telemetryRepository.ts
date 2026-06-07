import type { ProcessedRecord } from "../../core/telemetry/telemetryProcessingTypes";

export interface TelemetryRepository {
  saveBatch(records: ProcessedRecord[]): Promise<void>;
}
