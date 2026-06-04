import type { RejectedRecord } from "../../core/telemetry/telemetryTypes";

export interface RejectedRecordRepository {
  saveBatch(records: RejectedRecord[]): Promise<void>;
}
