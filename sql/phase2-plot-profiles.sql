-- Phase 1: Bio-Data Migration (The Bio-Chip)
-- Table to hold the full identity of each plot (Identity + Personality + State)

create table if not exists public.plot_profiles (
    slug text primary key,                        -- 'tamarind', 'house' (Human ID)
    name_th text not null,                        -- 'สวนมะขาม'
    lat double precision not null,
    lon double precision not null,
    
    -- The Living State (Mutable)
    stage text not null default 'vegetative',     -- 'bloom', 'fruit_set'
    
    -- The Personality/Bio-Traits (Immutable-ish)
    soil_type text not null,                      -- 'sandy_loam'
    water_source text not null,                   -- 'surface_water'
    sensitivity_drought int not null default 5,   -- 0-10 (10 = Very Sensitive)
    sensitivity_flood int not null default 5,     -- 0-10 (10 = Very Sensitive)
    critical_asset text,                          -- 'durian_monthong', 'showcase_zone'
    notes text,                                   -- Free text for context
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Comment to describe the table
comment on table public.plot_profiles is 'Stores the biological identity and state of each orchard plot (The Bio-Chip).';

-- Enable Row Level Security (RLS)
alter table public.plot_profiles enable row level security;

-- Policy: Allow Service Role full access
create policy "Enable all access for service role" on public.plot_profiles
    for all using (true) with check (true);

-- Extensions
create extension if not exists moddatetime schema extensions;

-- Trigger for updated_at
create trigger handle_updated_at before update on public.plot_profiles
  for each row execute procedure moddatetime (updated_at);
