import type { ProcessedRecord } from "../../core/telemetry/telemetryTypes";

export interface RecordRepository {
  saveBatch(records: ProcessedRecord[]): Promise<void>;
}
