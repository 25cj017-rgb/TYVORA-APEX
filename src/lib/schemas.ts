import { z } from "zod";

// Runtime validation schema for Satellite objects
export const SatelliteSchema = z.object({
  norad_id: z.number(),
  name: z.string(),
  tle_line1: z.string().optional().default(""),
  tle_line2: z.string().optional().default(""),
  last_updated: z.string().optional().default(new Date().toISOString()),
  status: z.string().optional().default("ACTIVE"),
  altitudeKm: z.number().optional().default(400),
  velocityKmS: z.number().optional().default(7.66),
  inclinationDeg: z.number().optional().default(51.6),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("LOW"),
});

export type ValidatedSatellite = z.infer<typeof SatelliteSchema>;

// Runtime validation schema for Space Debris
export const SpaceDebrisSchema = z.object({
  id: z.string(),
  name: z.string(),
  rcs: z.number(), // Radar Cross Section (m^2)
  velocity: z.number(), // km/s
  altitude: z.number(), // km
  riskScore: z.number().min(0).max(100),
});

export type ValidatedSpaceDebris = z.infer<typeof SpaceDebrisSchema>;

// Runtime validation schema for Conjunction Events
export const ConjunctionEventSchema = z.object({
  id: z.string(),
  primaryObject: z.string(),
  secondaryObject: z.string(),
  tca: z.string(), // Time of Closest Approach
  missDistance: z.number(), // meters
  collisionProbability: z.number(), // probability e.g. 0.0001
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  radialMiss: z.number().optional(),
  inTrackMiss: z.number().optional(),
  crossTrackMiss: z.number().optional(),
});

export type ValidatedConjunctionEvent = z.infer<typeof ConjunctionEventSchema>;

// API Response Schemas
export const TelemetryStreamSchema = z.object({
  timestamp: z.string(),
  activeSatellitesCount: z.number(),
  trackedDebrisCount: z.number(),
  criticalAlerts: z.array(ConjunctionEventSchema),
  systemLatencyMs: z.number(),
});

export type ValidatedTelemetryStream = z.infer<typeof TelemetryStreamSchema>;
