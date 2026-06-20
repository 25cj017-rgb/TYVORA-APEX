import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchSatelliteTLEs } from "@/services/spaceTrackService";

export async function POST(request: Request) {
  try {
    // 1. Secure the endpoint against unauthorized execution
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid CRON_SECRET." },
        { status: 401 }
      );
    }

    // 2. Fetch all unique NORAD IDs currently tracked in our database
    const { data: activeSatellites, error: fetchError } = await supabaseAdmin
      .from("satellites")
      .select("norad_id");

    if (fetchError || !activeSatellites || activeSatellites.length === 0) {
      return NextResponse.json(
        { message: "No active satellites found in the database to update." },
        { status: 200 }
      );
    }

    const targetNoradIds = activeSatellites.map(s => s.norad_id);

    // 3. Bulk query Space-Track for live TLEs
    const updatedTelemetry = await fetchSatelliteTLEs(targetNoradIds);

    if (!updatedTelemetry || updatedTelemetry.length === 0) {
      return NextResponse.json(
        { error: "Failed to retrieve telemetry from Space-Track." },
        { status: 502 }
      );
    }

    // 4. Update the database securely bypassing RLS using the admin client
    let successCount = 0;
    for (const sat of updatedTelemetry) {
      if (!sat.norad_id || !sat.tle_line1 || !sat.tle_line2) continue;

      const { error: updateError } = await supabaseAdmin
        .from("satellites")
        .update({
          tle_line1: sat.tle_line1,
          tle_line2: sat.tle_line2,
          last_updated: new Date().toISOString()
        })
        .eq("norad_id", sat.norad_id);

      if (!updateError) {
        successCount++;
      } else {
        console.error(`Failed to update NORAD ${sat.norad_id}:`, updateError);
      }
    }

    return NextResponse.json(
      { 
        message: "Telemetry ingestion complete.",
        requested: targetNoradIds.length,
        updated: successCount 
      },
      { status: 200 }
    );

  } catch (err: any) {
    console.error("Ingestion Worker Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error during ingestion." },
      { status: 500 }
    );
  }
}
