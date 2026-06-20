-- Supabase Schema Design: Tyvora Space Risk Intelligence Platform
-- Table: satellites
-- Description: Tracks monitored satellites, cataloged NORAD identifiers, and their active two-line element (TLE) sets.

-- Enable Row Level Security (RLS) and create the table
CREATE TABLE IF NOT EXISTS public.satellites (
    norad_id int8 PRIMARY KEY,                      -- Unique NORAD catalog identifier (int8 matching 64-bit integer)
    user_id uuid NOT NULL REFERENCES auth.users(id),-- Foreign key mapping to Supabase Auth user
    name text NOT NULL,                             -- Spacecraft common name
    tle_line1 text NOT NULL,                        -- Line 1 of the Two-Line Element (TLE) set
    tle_line2 text NOT NULL,                        -- Line 2 of the Two-Line Element (TLE) set
    last_updated timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL, -- Telemetry sync time
    status text DEFAULT 'active'::text NOT NULL     -- Status (e.g., active, inactive, decayed)
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.satellites ENABLE ROW LEVEL SECURITY;

-- Create basic indexes to optimize queries by status, last updated timestamp, and user tenant isolation
CREATE INDEX IF NOT EXISTS satellites_status_idx ON public.satellites (status);
CREATE INDEX IF NOT EXISTS satellites_last_updated_idx ON public.satellites (last_updated);
CREATE INDEX IF NOT EXISTS satellites_user_id_idx ON public.satellites (user_id);

-- Policies: Allow authenticated users to ONLY read their own fleet telemetry
CREATE POLICY "Allow authenticated read access to own satellites" 
ON public.satellites 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Policies: Restrict insert/update/delete only to authenticated service accounts OR the specific tenant owner
CREATE POLICY "Allow tenant write access to own satellites" 
ON public.satellites 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Create a helper function to automatically update 'last_updated' column on row modification
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger that calls the function before update
CREATE OR REPLACE TRIGGER update_satellites_last_updated
    BEFORE UPDATE ON public.satellites
    FOR EACH ROW
    EXECUTE FUNCTION update_last_updated_column();

-- ====================================================================================
-- VECTOR DATABASE CONFIGURATION (Phase 4: RAG Intelligence Layer)
-- ====================================================================================

-- 1. Enable the pgvector extension for high-dimensional embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the Knowledge Base Table for Aerospace Regulations
CREATE TABLE IF NOT EXISTS public.aerospace_regulations (
    id bigserial PRIMARY KEY,
    title text NOT NULL,                                  -- Document or Policy title
    content text NOT NULL,                                -- The raw text chunks of the regulation
    content_embedding vector(1536) NOT NULL,              -- OpenAI ada-002 compatible embedding dimension
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS on regulations
ALTER TABLE public.aerospace_regulations ENABLE ROW LEVEL SECURITY;

-- Allow public read access to regulations for RAG searches
CREATE POLICY "Allow public read access to regulations" 
ON public.aerospace_regulations 
FOR SELECT TO public USING (true);

-- Allow service role to ingest/manage regulations
CREATE POLICY "Allow service write access to regulations" 
ON public.aerospace_regulations 
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Create an HNSW Index for ultra-fast Approximate Nearest Neighbor (ANN) searches
CREATE INDEX IF NOT EXISTS regulations_embedding_idx 
ON public.aerospace_regulations 
USING hnsw (content_embedding vector_cosine_ops);

-- 5. Create the Semantic Search RPC (Remote Procedure Call)
CREATE OR REPLACE FUNCTION match_regulations (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.title,
    ar.content,
    1 - (ar.content_embedding <=> query_embedding) AS similarity
  FROM public.aerospace_regulations ar
  WHERE 1 - (ar.content_embedding <=> query_embedding) > match_threshold
  ORDER BY ar.content_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
