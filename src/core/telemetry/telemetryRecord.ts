import { z } from "zod";

const telemetryMetadataSchema = {
  droneId: z.string().min(1),
  timestamp: z.string().datetime(),
  statusCode: z.string().min(1)
};

export const telemetryRecordSchema = z.discriminatedUnion("eventType", [
  z.object({
    ...telemetryMetadataSchema,
    eventType: z.literal("location_update"),
    telemetryData: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      altitudeMeters: z.number().nonnegative()
    })
  }),
  z.object({
    ...telemetryMetadataSchema,
    eventType: z.literal("battery_update"),
    telemetryData: z.object({
      batteryPercent: z.number().min(0).max(100)
    })
  })
]);

export type TelemetryRecord = z.infer<typeof telemetryRecordSchema>;
