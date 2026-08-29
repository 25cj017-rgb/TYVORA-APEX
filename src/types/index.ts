// TypeScript interfaces and data models for Space Risk Intelligence.
export * from "./satellite";

export interface SpaceDebris {
  id: string;
  name: string;
  rcs: number; // Radar Cross Section (size in m^2)
  velocity: number; // km/s
  altitude: number; // km
  riskScore: number;
}

export interface ConjunctionEvent {
  id: string;
  primaryObject: string;
  secondaryObject: string;
  tca: string; // Time of Closest Approach
  missDistance: number; // meters
  collisionProbability: number; // probability value e.g. 1 in 10,000 (0.0001)
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  radialMiss: number;
  inTrackMiss: number;
  crossTrackMiss: number;
}

export interface TelemetryState {
  latencyMs: number;
  propagationErrorRmsKm: number;
  covarianceIntegrity: number;
  filterStatus: string;
}

export interface ManeuverPlan {
  deltaV_m_s: number;
  burnDirection: "PROGRADE" | "RETROGRADE" | "NORMAL" | "ANTINORMAL" | "RADIAL_IN" | "RADIAL_OUT";
  projectedMissDistanceKm: number;
}
