import * as satellite from "satellite.js";

export interface TLE {
  tle_line1: string;
  tle_line2: string;
}

export interface RiskAnalysisResult {
  probability: number;
  mahalanobisDistance: number;
  missDistanceKm: number;
  severity: "LOW" | "ELEVATED" | "CRITICAL";
  positionA: { x: number; y: number; z: number };
  positionB: { x: number; y: number; z: number };
}

/**
 * Calculates collision probability using a simplified covariance envelope (Mahalanobis distance)
 * derived from SGP4 orbital state vector propagation.
 */
export function calculateCollisionRisk(
  satA: TLE,
  satB: TLE,
  time: Date = new Date(),
  solarFluxF107: number = 150.0 // Atmospheric Physics Integration: Baseline F10.7 solar flux
): RiskAnalysisResult {
  // 1. Initialize SGP4 orbital record structures
  const satrecA = satellite.twoline2satrec(satA.tle_line1, satA.tle_line2);
  const satrecB = satellite.twoline2satrec(satB.tle_line1, satB.tle_line2);

  // Atmospheric Physics Integration: Adjust BSTAR drag term based on Solar Weather Flux
  // Higher solar flux drastically expands atmospheric density, increasing drag on LEO objects.
  const f107Scale = solarFluxF107 / 150.0;
  satrecA.bstar *= f107Scale;
  satrecB.bstar *= f107Scale;

  // 2. Propagate orbits to the designated TCA/Epoch timestamp
  const stateA = satellite.propagate(satrecA, time);
  const stateB = satellite.propagate(satrecB, time);

  // 3. Validate propagation success
  if (
    !stateA ||
    !stateB ||
    !stateA.position || 
    !stateB.position || 
    typeof stateA.position === "boolean" || 
    typeof stateB.position === "boolean"
  ) {
    throw new Error("SGP4 orbit propagation failed. Invalid TLE elements.");
  }

  // State vectors in True Equatorial / Mean Equinox (TEME) frame in kilometers
  const posA = stateA.position;
  const posB = stateB.position;

  // 4. Calculate relative position differences
  const dx = posA.x - posB.x;
  const dy = posA.y - posB.y;
  const dz = posA.z - posB.z;

  const missDistanceKm = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // 5. Compute Mahalanobis Distance using static covariance deviations (in kilometers)
  // Standard LEO TLE uncertainty deviations: 
  // Radial (Sigma X) = 1.0 km, Along-track (Sigma Y) = 2.5 km, Cross-track (Sigma Z) = 1.5 km
  const sigmaX = 1.0;
  const sigmaY = 2.5;
  const sigmaZ = 1.5;

  const dmSquared = 
    (dx * dx) / (sigmaX * sigmaX) + 
    (dy * dy) / (sigmaY * sigmaY) + 
    (dz * dz) / (sigmaZ * sigmaZ);
  
  const mahalanobisDistance = Math.sqrt(dmSquared);

  // 6. Map Mahalanobis distance to cumulative standard collision probability [0, 1]
  // Assumes a 3D Gaussian distribution envelope: P = e^(-D_M^2 / 2)
  const probability = Math.exp(-dmSquared / 2);

  // 7. Define severity classifications based on analytical bounds
  // LOW: < 0.001% (1e-5), ELEVATED: 0.001% to 0.05% (5e-4), CRITICAL: > 0.05%
  let severity: "LOW" | "ELEVATED" | "CRITICAL" = "LOW";
  if (probability > 0.0005) {
    severity = "CRITICAL";
  } else if (probability > 0.00001) {
    severity = "ELEVATED";
  }

  return {
    probability,
    mahalanobisDistance,
    missDistanceKm,
    severity,
    positionA: { x: posA.x, y: posA.y, z: posA.z },
    positionB: { x: posB.x, y: posB.y, z: posB.z },
  };
}

export interface ExplanationPayload {
  satAName: string;
  satBName: string;
  missDistanceKm: number;
  probability: number;
  severity: "LOW" | "ELEVATED" | "CRITICAL";
}

/**
 * Generates an executive technical summary explaining the conjunction risk via OpenAI Chat Completions.
 * Uses portable, dependency-free HTTPS requests fully compatible with serverless Edge environments (Deno).
 */
export async function generateRiskExplanation(
  riskData: ExplanationPayload
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // Elegant fallback description if API key is not configured in environment
    return `OPERATIONAL INTELLIGENCE BRIEFING: A close proximity conjunction has been resolved between target asset ${
      riskData.satAName
    } and hazard object ${
      riskData.satBName
    }. Based on current orbital telemetry, the calculated miss distance yields a tight ${
      riskData.missDistanceKm.toFixed(3)
    } km range, prompting an operational severity designation of ${
      riskData.severity
    }.`;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: 
              "You are a professional aerospace intelligence officer at Tyvora. Write a highly analytical, 2-sentence executive summary explaining the calculated conjunction risk. Focus strictly on orbital physics, relative parameters, and threats. Do not apologize, do not explain the code."
          },
          {
            role: "user",
            content: `SATELLITE A: ${riskData.satAName}
SATELLITE B: ${riskData.satBName}
MISS RANGE: ${riskData.missDistanceKm.toFixed(3)} km
COLLISION PROBABILITY: ${(riskData.probability * 100).toFixed(5)}%
SEVERITY LEVEL: ${riskData.severity}`
          }
        ],
        temperature: 0.25,
        max_tokens: 120,
      }),
    });

    const result = await response.json();
    return result.choices[0].message.content.trim();
  } catch (err) {
    console.error("Supabase Edge / OpenAI Completion request warning:", err);
    return `CORE ANALYTICS ALERT: Close-approach vector resolved between ${
      riskData.satAName
    } and ${riskData.satBName}. Estimated miss parameters indicate an orbital separation of ${
      riskData.missDistanceKm.toFixed(3)
    } km, classifying collision threshold index within standard ${
      riskData.severity
    } operational boundaries.`;
  }
}

export interface ManeuverStrategy {
  burnDirection: "PROGRADE" | "RETROGRADE";
  deltaV_m_s: number;
  timeToConjunctionSeconds: number;
  projectedMissDistanceKm: number;
}

/**
 * Autonomous Maneuver Strategy Synthesis Module
 * Calculates the required Delta-v maneuver to achieve a specific safe miss distance.
 * Now acts as a client wrapper for the backend Compute Layer API.
 */
export async function synthesizeManeuverStrategy(
  targetCorrectionMeters: number,
  timeToConjunctionSeconds: number
): Promise<ManeuverStrategy> {
  const response = await fetch('/api/compute/maneuver', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      targetMissDistanceMeters: targetCorrectionMeters, 
      timeToTcaSeconds: timeToConjunctionSeconds 
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch maneuver plan from Compute Layer.');
  }

  return response.json();
}
