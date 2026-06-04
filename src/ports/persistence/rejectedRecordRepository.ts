import type { RejectedTelemetryRecord } from "../../core/telemetry/telemetryTypes";

export interface RejectedRecordRepository {
  saveBatch(records: RejectedTelemetryRecord[]): Promise<void>;
}
