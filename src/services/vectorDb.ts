import { supabaseAdmin } from "@/lib/supabase-admin";

export interface RegulationMatch {
  id: number;
  title: string;
  content: string;
  similarity: number;
}

/**
 * Generates a 1536-dimensional vector embedding for a given text using OpenAI.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not defined. Cannot generate embedding.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-ada-002"
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to generate embedding: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data[0].embedding;
}

/**
 * Performs a semantic search against the aerospace_regulations vector database.
 */
export async function searchRegulations(query: string, matchThreshold = 0.75, matchCount = 3): Promise<RegulationMatch[]> {
  try {
    const queryEmbedding = await getEmbedding(query);

    const { data, error } = await supabaseAdmin.rpc("match_regulations", {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount
    });

    if (error) {
      console.error("Supabase RPC match_regulations failed:", error);
      return [];
    }

    return data as RegulationMatch[];
  } catch (err) {
    console.error("Semantic Search failed:", err);
    return [];
  }
}
