-- Phase 2: Weather Insights Table
-- Run this script in your Supabase SQL Editor

-- 1. Create the `weather_insights` table
CREATE TABLE IF NOT EXISTS public.weather_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    target_date DATE NOT NULL,
    location_id TEXT NOT NULL,
    category TEXT NOT NULL, -- 'irrigation', 'disease', 'physiology'
    status_level TEXT NOT NULL, -- 'critical', 'warning', 'optimal', 'info'
    message TEXT,
    trigger_data JSONB,
    
    CONSTRAINT weather_insights_unique_daily UNIQUE (location_id, target_date, category)
);

-- 2. Security (RLS)
ALTER TABLE public.weather_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for service role" ON public.weather_insights
    AS PERMISSIVE FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users" ON public.weather_insights
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_weather_insights_target ON public.weather_insights (target_date, location_id);

COMMENT ON TABLE public.weather_insights IS 'Stores actionable insights derived from weather forecasts based on Orchard Wisdom logic.';