import { NextResponse } from 'next/server';
import { calculateCollisionRisk } from '@/services/riskEngine';
import { ConjunctionEvent } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { satellites } = body;

    if (!satellites || !Array.isArray(satellites) || satellites.length < 2) {
      return NextResponse.json({ error: "Requires an array of at least 2 satellites." }, { status: 400 });
    }

    const conjunctions: ConjunctionEvent[] = [];
    const now = new Date();
    
    // We will sweep the next 24 hours in 30-minute intervals
    const timeWindowHours = 24;
    const stepMinutes = 30;
    
    // O(n^2) Pairwise iteration over all provided satellites
    for (let i = 0; i < satellites.length; i++) {
      for (let j = i + 1; j < satellites.length; j++) {
        const satA = satellites[i];
        const satB = satellites[j];

        // Ensure valid TLE data exists
        if (!satA.tle_line1 || !satB.tle_line1) continue;

        let closestApproach: ReturnType<typeof calculateCollisionRisk> | null = null;
        let tcaDate: Date = now;

        // Temporal Sweep
        for (let m = 0; m <= timeWindowHours * 60; m += stepMinutes) {
          const evalTime = new Date(now.getTime() + m * 60000);
          
          try {
            const risk = calculateCollisionRisk(satA, satB, evalTime);
            
            // Track the minimum miss distance during the 24-hour sweep
            if (!closestApproach || risk.missDistanceKm < closestApproach.missDistanceKm) {
              closestApproach = risk;
              tcaDate = evalTime;
            }
          } catch (e) {
            // SGP4 decay or invalid propagation step, skip safely
          }
        }

        // If a threat crosses the 10km warning envelope
        if (closestApproach && closestApproach.missDistanceKm < 10) {
          const randomId = Math.floor(Math.random() * 9000) + 1000;
          conjunctions.push({
            id: `CONJ-LIVE-${randomId}`,
            primaryObject: satA.name,
            secondaryObject: satB.name,
            tca: tcaDate.toISOString().replace("T", " ").substring(0, 19) + " UTC",
            missDistance: Math.floor(closestApproach.missDistanceKm * 1000), // convert to meters
            collisionProbability: parseFloat((closestApproach.probability * 100).toFixed(6)),
            severity: closestApproach.severity,
            // Extract directional differences (approximated for prototype output)
            radialMiss: parseFloat((Math.abs(closestApproach.positionA.x - closestApproach.positionB.x)).toFixed(1)),
            inTrackMiss: parseFloat((Math.abs(closestApproach.positionA.y - closestApproach.positionB.y)).toFixed(1)),
            crossTrackMiss: parseFloat((Math.abs(closestApproach.positionA.z - closestApproach.positionB.z)).toFixed(1)),
          });
        }
      }
    }

    // Sort by severity (distance)
    conjunctions.sort((a, b) => a.missDistance - b.missDistance);

    return NextResponse.json({ 
      success: true, 
      evaluatedPairs: (satellites.length * (satellites.length - 1)) / 2,
      threatsDetected: conjunctions.length,
      conjunctions 
    });

  } catch (err) {
    console.error("Conjunction Matrix Error:", err);
    return NextResponse.json({ error: 'Failed to compute conjunction matrix' }, { status: 500 });
  }
}
