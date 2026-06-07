import type { RejectedRecord } from "../../core/telemetry/telemetryProcessingTypes";

export interface RejectedTelemetryRepository {
  saveBatch(records: RejectedRecord[]): Promise<void>;
}
