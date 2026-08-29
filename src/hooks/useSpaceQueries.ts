import { useQuery } from "@tanstack/react-query";
import {
  SatelliteSchema,
  ConjunctionEventSchema,
  TelemetryStreamSchema,
  ValidatedSatellite,
  ValidatedConjunctionEvent,
  ValidatedTelemetryStream,
} from "../lib/schemas";
import { z } from "zod";
import { supabase } from "../lib/supabase";

// Mock/Live data fetchers
async function fetchSatellites(): Promise<ValidatedSatellite[]> {
  try {
    const { data, error } = await supabase.from("satellites").select("*");
    if (data && !error && data.length > 0) {
      const formatted = data.map((item: any) => ({
        norad_id: item.norad_id,
        name: item.name,
        tle_line1: item.tle_line1 || "",
        tle_line2: item.tle_line2 || "",
        status: item.status || "ACTIVE",
        last_updated: item.last_updated || new Date().toISOString(),
        altitudeKm: 420.5,
        velocityKmS: 7.66,
        inclinationDeg: 51.64,
        riskLevel: "LOW",
      }));
      return z.array(SatelliteSchema).parse(formatted);
    }
  } catch (err) {
    console.warn("Supabase fetch failed, falling back to mock active satellites:", err);
  }

  const rawData = [
    {
      norad_id: 25544,
      name: "ISS (Space Station)",
      tle_line1: "1 25544U 98067A   26143.49887731  .00014603  00000-0  26307-3 0  9997",
      tle_line2: "2 25544  51.6423 331.4284 0004739 301.8842 165.7483 15.49826727568550",
      status: "ACTIVE",
      last_updated: new Date().toISOString(),
      altitudeKm: 420.5,
      velocityKmS: 7.66,
      inclinationDeg: 51.64,
      riskLevel: "LOW",
    },
    {
      norad_id: 20580,
      name: "HST (Hubble)",
      tle_line1: "1 20580U 90037B   26143.19504630  .00000858  00000-0  73413-4 0  9991",
      tle_line2: "2 20580  28.4688 285.9261 0003014 345.9224  14.1741 15.00392764956108",
      status: "ACTIVE",
      last_updated: new Date().toISOString(),
      altitudeKm: 540.2,
      velocityKmS: 7.59,
      inclinationDeg: 28.47,
      riskLevel: "LOW",
    },
    {
      norad_id: 40091,
      name: "Sentinel-2A",
      tle_line1: "1 40091U 15028A   26143.50000000  .00000100  00000-0  10000-4 0  9999",
      tle_line2: "2 40091  98.5621 123.4567 0001000  90.0000 270.0000 14.32100000500000",
      status: "ACTIVE",
      last_updated: new Date().toISOString(),
      altitudeKm: 786.1,
      velocityKmS: 7.46,
      inclinationDeg: 98.56,
      riskLevel: "LOW",
    },
    {
      norad_id: 39084,
      name: "Landsat-8",
      tle_line1: "1 39084U 13008A   26143.50000000  .00000100  00000-0  10000-4 0  9999",
      tle_line2: "2 39084  98.2000 100.0000 0001200  90.0000 270.0000 14.50000000500000",
      status: "ACTIVE",
      last_updated: new Date().toISOString(),
      altitudeKm: 705.4,
      velocityKmS: 7.50,
      inclinationDeg: 98.2,
      riskLevel: "LOW",
    },
    {
      norad_id: 37384,
      name: "GPS III-01",
      tle_line1: "1 37384U 11036A   26143.50000000  .00000010  00000-0  00000-0 0  9999",
      tle_line2: "2 37384  55.0000 150.0000 0050000  90.0000 270.0000  2.00000000500000",
      status: "ACTIVE",
      last_updated: new Date().toISOString(),
      altitudeKm: 20200.0,
      velocityKmS: 3.88,
      inclinationDeg: 55.0,
      riskLevel: "LOW",
    },
    {
      norad_id: 41334,
      name: "Iridium-100",
      tle_line1: "1 41334U 16011A   26143.50000000  .00000500  00000-0  50000-4 0  9999",
      tle_line2: "2 41334  86.4000  50.0000 0010000  90.0000 270.0000 14.34200000500000",
      status: "ACTIVE",
      last_updated: new Date().toISOString(),
      altitudeKm: 780.0,
      velocityKmS: 7.47,
      inclinationDeg: 86.4,
      riskLevel: "LOW",
    },
    {
      norad_id: 33591,
      name: "NOAA-19",
      tle_line1: "1 33591U 09005A   26143.48625000  .00000084  00000-0  68725-4 0  9993",
      tle_line2: "2 33591  99.1415 158.7303 0013926  87.2341 273.0112 14.12450837887321",
      status: "ACTIVE",
      last_updated: new Date().toISOString(),
      altitudeKm: 860.4,
      velocityKmS: 7.42,
      inclinationDeg: 99.14,
      riskLevel: "LOW",
    }
  ];

  return z.array(SatelliteSchema).parse(rawData);
}

async function fetchConjunctionAlerts(satellites?: ValidatedSatellite[]): Promise<ValidatedConjunctionEvent[]> {
  if (satellites && satellites.length >= 2) {
    try {
      const response = await fetch("/api/compute/conjunctions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ satellites }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.success && Array.isArray(data.conjunctions)) {
          return z.array(ConjunctionEventSchema).parse(data.conjunctions);
        }
      }
    } catch (err) {
      console.warn("Backend sweeper API unavailable, using mock fallback:", err);
    }
  }

  const rawData = [
    {
      id: "CONJ-2026-904",
      primaryObject: "ISS (Space Station)",
      secondaryObject: "CZ-4C Debris (40932)",
      tca: new Date(Date.now() + 3600000 * 4).toISOString().replace("T", " ").substring(0, 19) + " UTC",
      missDistance: 142,
      collisionProbability: 0.00045,
      severity: "CRITICAL",
      radialMiss: 38.4,
      inTrackMiss: 112.1,
      crossTrackMiss: 80.5,
    },
    {
      id: "CONJ-2026-905",
      primaryObject: "Tyvora-Sat 1A",
      secondaryObject: "Falcon Debris (58392)",
      tca: new Date(Date.now() + 3600000 * 8).toISOString().replace("T", " ").substring(0, 19) + " UTC",
      missDistance: 310,
      collisionProbability: 0.00008,
      severity: "HIGH",
      radialMiss: 92.1,
      inTrackMiss: 245.3,
      crossTrackMiss: 168.2,
    },
    {
      id: "CONJ-2026-906",
      primaryObject: "GPS III-06",
      secondaryObject: "SL-12 R/B Debris",
      tca: new Date(Date.now() + 3600000 * 18).toISOString().replace("T", " ").substring(0, 19) + " UTC",
      missDistance: 980,
      collisionProbability: 0.000005,
      severity: "MEDIUM",
      radialMiss: 210.4,
      inTrackMiss: 890.1,
      crossTrackMiss: 412.3,
    },
  ];

  return z.array(ConjunctionEventSchema).parse(rawData);
}

async function fetchTelemetryStream(satellites?: ValidatedSatellite[]): Promise<ValidatedTelemetryStream> {
  const rawData = {
    timestamp: new Date().toISOString(),
    activeSatellitesCount: satellites?.length || 7,
    trackedDebrisCount: 26104,
    criticalAlerts: await fetchConjunctionAlerts(satellites),
    systemLatencyMs: Math.floor(Math.random() * 15) + 12,
  };

  return TelemetryStreamSchema.parse(rawData);
}

// React Query Hooks
export function useActiveSatellites() {
  return useQuery({
    queryKey: ["satellites", "active"],
    queryFn: fetchSatellites,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function useConjunctionAlerts(satellites?: ValidatedSatellite[]) {
  return useQuery({
    queryKey: ["conjunctions", "alerts", satellites?.map(s => s.norad_id).join(",")],
    queryFn: () => fetchConjunctionAlerts(satellites),
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

export function useTelemetryStream(satellites?: ValidatedSatellite[]) {
  return useQuery({
    queryKey: ["telemetry", "stream", satellites?.map(s => s.norad_id).join(",")],
    queryFn: () => fetchTelemetryStream(satellites),
    refetchInterval: 5000,
  });
}

// ── LIVE DEBRIS HOOK ──────────────────────────────────────────────────────────
// Fetches real Cosmos-2251 / Iridium-33 debris TLEs from CelesTrak via our
// /api/debris proxy route. These are actual catalogued objects tracked by NORAD.
async function fetchLiveDebris(): Promise<ValidatedSatellite[]> {
  try {
    const response = await fetch("/api/debris");
    if (!response.ok) throw new Error("Debris API failed");
    const json = await response.json();
    if (json.success && Array.isArray(json.debris) && json.debris.length > 0) {
      // Map debris objects into our satellite schema for globe rendering
      return json.debris
        .filter((d: any) => d.tle_line1 && d.tle_line2)
        .map((d: any) => ({
          norad_id: d.norad_id,
          name: d.name,
          tle_line1: d.tle_line1,
          tle_line2: d.tle_line2,
          status: "ACTIVE" as const,
          last_updated: d.last_updated,
          altitudeKm: d.altitudeKm || 780,
          velocityKmS: d.velocityKmS || 7.46,
          inclinationDeg: d.inclinationDeg || 74.0,
          riskLevel: "HIGH" as const,
        }));
    }
  } catch (err) {
    console.warn("Live debris fetch failed:", err);
  }
  return [];
}

export function useLiveDebris() {
  return useQuery({
    queryKey: ["debris", "live"],
    queryFn: fetchLiveDebris,
    refetchInterval: 3600000, // TLEs are stable for hours, refresh every hour
    staleTime: 1800000,
  });
}

