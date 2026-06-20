import { NextRequest, NextResponse } from "next/server";
import { fetchSatelliteTLE } from "../../../services/spaceTrackService";

/**
 * Test Route Handler: GET /api/test-spacetrack
 * 
 * Triggers the Space-Track fetchSatelliteTLE service for a given 'id' query parameter.
 * Default is NORAD ID 25544 (International Space Station - ISS).
 * 
 * Example URL: http://localhost:3000/api/test-spacetrack?id=25544
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");
  const noradId = idParam ? parseInt(idParam, 10) : 25544;

  if (isNaN(noradId)) {
    return NextResponse.json(
      { error: "Invalid parameter. Please provide a valid integer for 'id'." },
      { status: 400 }
    );
  }

  try {
    console.log(`[Test Route] Initiating TLE extraction sequence for NORAD ID: ${noradId}`);
    
    // Trigger the ingestion function
    await fetchSatelliteTLE(noradId);

    return NextResponse.json({
      success: true,
      message: `Space-Track fetch triggered successfully for NORAD ID: ${noradId}. Check your terminal/server logs for the raw response.`,
      query_norad_id: noradId,
      test_instructions: "Define SPACE_TRACK_USER and SPACE_TRACK_PASS in your .env.local to see live responses."
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Fetch failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
