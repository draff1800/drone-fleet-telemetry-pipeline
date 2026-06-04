import type { TelemetryRecord } from "./telemetryInput";

export interface RawTelemetryMessage {
  messageId?: string;
  body: string;
}

export interface ProcessedTelemetryRecord extends TelemetryRecord {
  recordId: string;
  processedAt: string;
}

export type RejectionReason = "INVALID_JSON" | "VALIDATION_FAILED";

export interface RejectedTelemetryError {
  path: string;
  code: string;
  message: string;
}

export interface RejectedTelemetryRecord {
  messageId?: string;
  body: string;
  reason: RejectionReason;
  errors: RejectedTelemetryError[];
  rejectedAt: string;
}

export interface ProcessingSummary {
  received: number;
  processed: number;
  rejected: number;
}
