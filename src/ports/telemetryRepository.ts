import type {
  ProcessedTelemetryRecord,
  RejectedTelemetryRecord
} from "../core/telemetry/telemetryTypes";

export interface TelemetryRepository {
  saveBatch(records: ProcessedTelemetryRecord[]): Promise<void>;
}

export interface RejectedRecordRepository {
  saveBatch(records: RejectedTelemetryRecord[]): Promise<void>;
}
