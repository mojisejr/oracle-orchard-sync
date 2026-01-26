export interface PlotLocation {
  lat: number;
  lon: number;
  name_th: string;
}

export type GrowthStage = 'preparing_leaf' | 'induction' | 'bloom' | 'fruit_set' | 'harvest' | 'seedling';
export type SoilType = 'sandy' | 'loamy' | 'loamy_sandy' | 'clayey' | 'clayey_filled';
export type WaterSourceQuality = 'normal' | 'high_manganese_iron' | 'clean_mountain' | 'brackish';

export interface PlotProfile extends PlotLocation {
  stage: GrowthStage;
  soil: SoilType;
  water: WaterSourceQuality;
}

// Default location (Suan Ban)
// Lat: 12.552966822391197, Lon: 102.15555705041479
const DEFAULT_PROFILE: PlotProfile = {
  lat: 12.552967,
  lon: 102.155557,
  name_th: 'สวนบ้าน',
  stage: 'bloom',
  soil: 'loamy_sandy',
  water: 'clean_mountain'
};

/**
 * Database of Plot Locations and Context
 * Key: Plot Code (slug)
 * Mapped from orchard-profile.md
 */
export const PLOT_PROFILES: Record<string, PlotProfile> = {
  'house': DEFAULT_PROFILE,
  
  // Plot: Tamarind (สวนมะขาม)
  // Stage: Bloom, Soil: Sandy, Water: High Fe/Mn
  'tamarind': {
    lat: 12.658602,
    lon: 102.204633,
    name_th: 'สวนมะขาม',
    stage: 'bloom',
    soil: 'sandy',
    water: 'high_manganese_iron'
  },
  
  // Plot: Lower Plot (สวนล่าง)
  // Stage: Preparing, Soil: Clayey Filled, Water: Normal/Shallow
  'lower': {
    lat: 12.546194,
    lon: 102.140010,
    name_th: 'สวนล่าง',
    stage: 'preparing_leaf',
    soil: 'clayey_filled',
    water: 'normal'
  },
  
  // Plot: Nursery / Pram (แปลงพันธุ์ไม้)
  // Stage: Seedling
  'pram': {
    lat: 12.552967,
    lon: 102.155557,
    name_th: 'แปลงพันธุ์ไม้',
    stage: 'seedling',
    soil: 'loamy_sandy',
    water: 'clean_mountain'
  }
};

/**
 * Resolve plot name to coordinates
 * Handles specific Thai names, English slugs, and fuzzy matching phases
 */
export function resolvePlotLocation(inputName: string): PlotLocation {
  const profile = resolvePlotProfile(inputName);
  return {
    lat: profile.lat,
    lon: profile.lon,
    name_th: profile.name_th
  }
}

export function resolvePlotProfile(inputName: string): PlotProfile {
  // 1. Exact Match (Slug)
  if (PLOT_PROFILES[inputName]) {
    return PLOT_PROFILES[inputName];
  }

  // 2. Keyword Matching (Thai/English)
  const normalized = inputName.toLowerCase().trim();

  if (normalized.includes('บ้าน') || normalized.includes('house')) {
    return PLOT_PROFILES['house'];
  }

  if (normalized.includes('มะขาม') || normalized.includes('tamarind')) {
    return PLOT_PROFILES['tamarind'];
  }

  if (normalized.includes('ล่าง') || normalized.includes('lower') || normalized.includes('bottom')) {
    return PLOT_PROFILES['lower'];
  }

  if (normalized.includes('พันธุ์ไม้') || normalized.includes('pram')) {
    return PLOT_PROFILES['pram'];
  }

  // 3. Fallback
  console.warn(`⚠️ Plot Mapper: Unknown plot "${inputName}". Using default profile (House).`);
  return DEFAULT_PROFILE;
}
