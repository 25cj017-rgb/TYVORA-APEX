import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("Missing env variable: NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  console.error("Missing env variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Initialize the client. We fallback to placeholders if they are not provided 
// to prevent application crash during static build or early initialization.
export const supabase = createClient(
  supabaseUrl || "https://missing-supabase-url.supabase.co",
  supabaseAnonKey || "missing-supabase-anon-key"
);
