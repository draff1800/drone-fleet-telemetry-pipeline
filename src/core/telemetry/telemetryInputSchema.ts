import { z } from "zod";

export const telemetryEventTypeSchema = z.enum([
  "BATTERY_STATUS",
  "SENSOR_READING",
  "ROUTE_ADJUSTED",
  "DELIVERY_COMPLETED",
  "ERROR"
]);

export const telemetryStatusCodeSchema = z.enum([
  "OK", 
  "WARN", 
  "ERROR"
]);

export const telemetryDataSchema = z
  .object({
    batteryLevel: z.number().min(0).max(100).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional()
  })
  .catchall(z.unknown());

export const telemetryInputSchema = z.object({
  droneId: z.string().min(1),
  timestamp: z.iso.datetime(),
  eventType: telemetryEventTypeSchema,
  statusCode: telemetryStatusCodeSchema,
  telemetryData: telemetryDataSchema
});

export type TelemetryInput = z.infer<typeof telemetryInputSchema>;
