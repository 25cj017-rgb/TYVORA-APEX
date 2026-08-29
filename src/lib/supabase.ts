import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!rawUrl) {
  console.warn("Missing env variable: NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  console.warn("Missing env variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") : "https://missing-supabase-url.supabase.co";

// Initialize the client. We fallback to placeholders if they are not provided 
// to prevent application crash during static build or early initialization.
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || "missing-supabase-anon-key"
);
