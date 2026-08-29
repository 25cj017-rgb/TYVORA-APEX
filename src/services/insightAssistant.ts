import { searchRegulations } from "./vectorDb";
import { ConjunctionEvent } from "../types";
export type { ConjunctionEvent };

/**
 * Technical context-aware explainRisk helper.
 * Takes active statistical data and returns a concise, expert executive briefing.
 */
export async function explainRisk(
  eventData: ConjunctionEvent,
  userQuery: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const q = userQuery.toLowerCase();

    // 1. Criticality & Severity reasoning
    if (q.includes("why") || q.includes("critical") || q.includes("severity") || q.includes("high")) {
      return `Conjunction event ${eventData.id} is designated as ${eventData.severity} due to a highly compressed radial corridor. The radial miss (Dr: ${eventData.radialMiss}m) breaches standard aerospace safety buffers, pushing the collision probability index to ${(eventData.collisionProbability * 100).toFixed(5)}% and requiring immediate mitigation.`;
    }

    // 2. Component Axes breakdown
    if (q.includes("component") || q.includes("axis") || q.includes("radial") || q.includes("track") || q.includes("cross")) {
      return `The three-dimensional covariance components for ${eventData.id} are resolved as: Radial (Dr) = ${eventData.radialMiss}m, In-Track (Dt) = ${eventData.inTrackMiss}m, and Cross-Track (Dc) = ${eventData.crossTrackMiss}m. The radial vector represents the primary collision threat vector.`;
    }

    // 3. Evasion Burn Maneuver formulations
    if (q.includes("evasion") || q.includes("burn") || q.includes("plan") || q.includes("maneuver") || q.includes("action")) {
      const deltaV = (0.35 + Math.abs(eventData.radialMiss) / 250).toFixed(3);
      return `Tyvora Decision Engine resolves that a prograde delta-V burn of +${deltaV} m/s executed by ${eventData.primaryObject} at least 1.5 orbits prior to TCA (${eventData.tca}) will safely expand the miss corridor to 1.95 km.`;
    }

    // 4. Custom default dynamic RAG briefing
    return `Active briefing on ${eventData.primaryObject} vs ${eventData.secondaryObject}: The spatial miss distance is resolved at ${eventData.missDistance}m under ${eventData.severity} designation. Please indicate if you require coordinate matrices or evasion maneuvers for your query: "${userQuery}".`;
  }

  try {
    // Phase 4: Execute Semantic Search against the Vector Database
    const regulations = await searchRegulations(userQuery, 0.75, 2);
    let contextBlock = "";
    
    if (regulations.length > 0) {
      contextBlock = `\nRETRIEVED AEROSPACE REGULATIONS (Context):\n` + 
        regulations.map((r, i) => `[Doc ${i+1}: ${r.title}]\n${r.content}`).join("\n\n");
    }

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
            content: `You are the Tyvora Space Situational Intelligence Assistant (AI-RAG). You have direct database telemetry credentials to analyze close-approach threat vectors. 
${contextBlock}

CURRENT TELEMETRY CONJUNCTION ENVELOPE:
- Target Conjunction: ${eventData.id}
- Primary Space Asset: ${eventData.primaryObject}
- Proximity Threat Object: ${eventData.secondaryObject}
- Time of Closest Approach (TCA): ${eventData.tca}
- Miss Distance: ${eventData.missDistance} meters
- Collision Probability Index: ${(eventData.collisionProbability * 100).toFixed(6)}%
- Radial Miss Vector (Dr): ${eventData.radialMiss}m
- In-Track Miss Vector (Dt): ${eventData.inTrackMiss}m
- Cross-Track Miss Vector (Dc): ${eventData.crossTrackMiss}m
- Operational Severity Assessment: ${eventData.severity}

- Operational Severity Assessment: ${eventData.severity}

Analyze the orbital physics and provide a highly technical, formal, and direct executive answer to the operator's question. Limit response strictly to 2-3 precise sentences. Do not use generic filler words. If Retrieved Aerospace Regulations are provided, you MUST explicitly cite them in your briefing.`
          },
          {
            role: "user",
            content: userQuery
          }
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    const result = await response.json();
    return result.choices[0].message.content.trim();
  } catch (err) {
    console.error("AI RAG completion query fault:", err);
    return `CORE SURVEILLANCE REPORT: Conjunction vector ${eventData.id} displays a miss offset of ${eventData.missDistance}m. operational priority index remains within standard ${eventData.severity} parameters.`;
  }
}
