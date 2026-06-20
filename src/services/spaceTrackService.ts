
import { Satellite } from "@/types";

/**
 * Fetches Two-Line Element (TLE) orbital data for multiple satellites from the Space-Track API.
 * Uses process.env.SPACE_TRACK_USER and process.env.SPACE_TRACK_PASS for authentication.
 * 
 * ⚠️ SECURITY BEST PRACTICE:
 * These credentials must be handled via server-side environment variables and should
 * NEVER be prefixed with NEXT_PUBLIC_ or exposed to client-side components.
 * 
 * @param norad_ids - An array of NORAD catalog IDs of the target satellites.
 * @returns Array of parsed satellite TLE data.
 */
export async function fetchSatelliteTLEs(norad_ids: number[]): Promise<Partial<Satellite>[]> {
  // Place server-side credentials here
  const username = process.env.SPACE_TRACK_USER;
  const password = process.env.SPACE_TRACK_PASS;

  if (!username || !password) {
    console.error(
      "Error: SPACE_TRACK_USER and SPACE_TRACK_PASS environment variables are missing on the server. " +
      "Please define them securely in your .env.local file."
    );
    return [];
  }

  const loginUrl = "https://www.space-track.org/ajaxauth/login";
  const idString = norad_ids.join(',');
  const queryUrl = `https://www.space-track.org/basicspacedata/query/class/gp/norad_cat_id/${idString}/format/json`;

  try {
    console.log(`[Space-Track] Initiating bulk TLE fetch for NORAD IDs: ${idString}...`);

    // 1. Authenticate with Space-Track API to establish a session
    const authResponse = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `identity=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication request failed with status: ${authResponse.status}`);
    }

    console.log(`[Space-Track] Auth POST status: ${authResponse.status} ${authResponse.statusText}`);
    const authText = await authResponse.clone().text();
    
    // Check if Space-Track returned a successful authentication payload
    if (authText.includes('"Login":"Failed"')) {
      throw new Error("Space-Track login failed. Please check your SPACE_TRACK_USER and SPACE_TRACK_PASS in your .env.local file.");
    }

    // Capture cookie headers safely using modern getSetCookie() to handle multi-cookie response arrays
    const rawCookies = authResponse.headers.getSetCookie();
    if (!rawCookies || rawCookies.length === 0) {
      throw new Error("No session cookies returned from Space-Track. Please check your credentials.");
    }

    // Format the cookie headers as a semicolon-separated string for the Cookie request header
    const cookieHeader = rawCookies.map(cookie => cookie.split(";")[0]).join("; ");

    // 2. Query TLE data from Space-Track catalog using the session cookie
    const response = await fetch(queryUrl, {
      method: "GET",
      headers: {
        "Cookie": cookieHeader,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Data query request failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log(`[Space-Track] Telemetry data retrieved successfully for ${data.length} objects.`);
    
    // Map Space-Track JSON fields to our internal Satellite model
    const satellites: Partial<Satellite>[] = data.map((item: any) => ({
      norad_id: parseInt(item.NORAD_CAT_ID, 10),
      name: item.OBJECT_NAME,
      tle_line1: item.TLE_LINE1,
      tle_line2: item.TLE_LINE2,
      status: "ACTIVE", // Defaulting to ACTIVE if it exists in the GP query
    }));

    return satellites;

  } catch (error) {
    console.error(`[Space-Track] Error fetching TLE data:`, error);
    return [];
  }
}
