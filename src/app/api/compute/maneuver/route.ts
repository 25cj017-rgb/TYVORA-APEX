import { NextResponse } from 'next/server';
import { ManeuverPlan } from '@/types';

// Physics Constants for LEO Perturbations
const MU = 3.986004418e14; // Earth's gravitational constant (m^3/s^2)
const R_EARTH = 6371000; // Earth radius (m)
const J2 = 0.00108263; // Earth's oblateness perturbation constant

// Standard assumed LEO spacecraft properties (approximated for Starlink/Target class)
const CD = 2.2; // Drag Coefficient
const A_M_RATIO = 0.05; // Area-to-Mass ratio (m^2/kg)
const ATMOSPHERIC_RHO = 1e-12; // Baseline atmospheric density at ~400km (kg/m^3)

// Moved from src/services/riskEngine.ts
function synthesizeManeuverStrategy(targetMissDistanceMeters: number, timeToTcaSeconds: number): ManeuverPlan {
  const orbitalRadius = R_EARTH + 400000; // rough 400km LEO assumption
  
  // 1. Unperturbed Mean Motion (n)
  const n_unperturbed = Math.sqrt(MU / Math.pow(orbitalRadius, 3));

  // 2. J2 Perturbed Mean Motion Correction (Assuming typical 53-degree inclination)
  const inc = (53.0 * Math.PI) / 180.0;
  const j2_factor = 1.5 * J2 * Math.pow(R_EARTH / orbitalRadius, 2) * (1 - 1.5 * Math.pow(Math.sin(inc), 2));
  const n_perturbed = n_unperturbed * (1 + j2_factor);

  // 3. Target Drift Rate using Perturbed Motion
  const driftRateRequired = targetMissDistanceMeters / timeToTcaSeconds;
  
  // Calculate baseline delta-V required using Clohessy-Wiltshire under J2
  let deltaV_cw = (driftRateRequired * n_perturbed * orbitalRadius) / (3 * Math.PI);

  // 4. Atmospheric Drag Decay Calculation
  // Over the time to TCA, the satellite will lose velocity to drag.
  // We must calculate the drag delta-V and ADD it to our required thrust to compensate.
  const orbitalVelocity = Math.sqrt(MU / orbitalRadius);
  const drag_deceleration = 0.5 * ATMOSPHERIC_RHO * Math.pow(orbitalVelocity, 2) * CD * A_M_RATIO;
  const drag_deltaV_loss = drag_deceleration * timeToTcaSeconds;

  // Final compensated Delta-V
  let final_deltaV = Math.abs(deltaV_cw) + drag_deltaV_loss;

  // Formatting and direction logic
  return {
    deltaV_m_s: parseFloat(final_deltaV.toFixed(4)),
    burnDirection: "PROGRADE",
    projectedMissDistanceKm: parseFloat((targetMissDistanceMeters / 1000).toFixed(2)),
  };
}

export async function POST(req: Request) {
  try {
    const { targetMissDistanceMeters, timeToTcaSeconds } = await req.json();

    if (targetMissDistanceMeters == null || timeToTcaSeconds == null) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const plan = synthesizeManeuverStrategy(targetMissDistanceMeters, timeToTcaSeconds);

    return NextResponse.json(plan);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to synthesize maneuver' }, { status: 500 });
  }
}
