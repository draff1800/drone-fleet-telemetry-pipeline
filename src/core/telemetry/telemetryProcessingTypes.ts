import type { TelemetryInput } from "./telemetryInputSchema";

export interface RawMessage {
  messageId?: string;
  body: string;
}

export interface ProcessedRecord extends TelemetryInput {
  recordId: string;
  processedAt: string;
}

export type RejectionReason = "INVALID_JSON" | "VALIDATION_FAILED";

export interface RejectionError {
  path: string;
  code: string;
  message: string;
}

export interface RejectedRecord {
  messageId?: string;
  body: string;
  reason: RejectionReason;
  errors: RejectionError[];
  rejectedAt: string;
}

export interface ProcessingSummary {
  received: number;
  processed: number;
  rejected: number;
}
