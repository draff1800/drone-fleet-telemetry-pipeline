import type { TelemetryRecord } from "./telemetryInput";

export interface RawMessage {
  messageId?: string;
  body: string;
}

export interface ProcessedRecord extends TelemetryRecord {
  recordId: string;
  processedAt: string;
}

export type RejectionReason = "INVALID_JSON" | "VALIDATION_FAILED";

export interface RejectedError {
  path: string;
  code: string;
  message: string;
}

export interface RejectedRecord {
  messageId?: string;
  body: string;
  reason: RejectionReason;
  errors: RejectedError[];
  rejectedAt: string;
}

export interface ProcessingSummary {
  received: number;
  processed: number;
  rejected: number;
}
