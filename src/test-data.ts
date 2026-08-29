import { fetchSatelliteTLEs } from "./services/spaceTrackService";

/**
 * Direct Telemetry Test Script
 * Runs the fetchSatelliteTLEs logic with NORAD ID 25544 (ISS) to verify credentials and connectivity.
 */
async function runTest() {
  console.log("=== TYVORA INGESTION PIPELINE: STARTING TEST ===");
  const testNoradId = 25544; // International Space Station (ISS)

  try {
    // Invoke the ingestion service function
    await fetchSatelliteTLEs([testNoradId]);
    console.log("=== TYVORA INGESTION PIPELINE: TEST RUN COMPLETION ===");
  } catch (error) {
    console.error("=== TYVORA INGESTION PIPELINE: TEST RUN FAILURE ===");
    console.error("Reason:", error);
  }
}

// Execute the test script
runTest();
