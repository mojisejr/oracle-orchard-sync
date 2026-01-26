export interface PlotLocation {
  lat: number;
  lon: number;
  name_th: string;
}

// Default location (Suan Ban)
// Lat: 12.552966822391197, Lon: 102.15555705041479
const DEFAULT_LOCATION: PlotLocation = {
  lat: 12.552967,
  lon: 102.155557,
  name_th: 'สวนบ้าน'
};

/**
 * Database of Plot Locations
 * Key: Plot Code (slug)
 */
export const PLOT_LOCATIONS: Record<string, PlotLocation> = {
  'house': DEFAULT_LOCATION,
  
  // Plot: Tamarind (สวนมะขาม)
  'tamarind': {
    lat: 12.658602,
    lon: 102.204633,
    name_th: 'สวนมะขาม'
  },
  
  // Plot: Lower Plot (สวนล่าง)
  'lower': {
    lat: 12.546194,
    lon: 102.140010,
    name_th: 'สวนล่าง'
  },
  
  // Plot: Nursery / Pram (แปลงพันธุ์ไม้)
  'pram': {
    lat: 12.552967,
    lon: 102.155557,
    name_th: 'แปลงพันธุ์ไม้'
  }
};

/**
 * Resolve plot name to coordinates
 * Handles specific Thai names, English slugs, and fuzzy matching phases
 */
export function resolvePlotLocation(inputName: string): PlotLocation {
  // 1. Exact Match (Slug)
  if (PLOT_LOCATIONS[inputName]) {
    return PLOT_LOCATIONS[inputName];
  }

  // 2. Keyword Matching (Thai/English)
  const normalized = inputName.toLowerCase().trim();

  if (normalized.includes('บ้าน') || normalized.includes('house')) {
    return PLOT_LOCATIONS['house'];
  }

  if (normalized.includes('มะขาม') || normalized.includes('tamarind')) {
    return PLOT_LOCATIONS['tamarind'];
  }

  if (normalized.includes('ล่าง') || normalized.includes('lower') || normalized.includes('bottom')) {
    return PLOT_LOCATIONS['lower'];
  }

  if (normalized.includes('พันธุ์ไม้') || normalized.includes('pram')) {
    return PLOT_LOCATIONS['pram'];
  }

  // 3. Fallback
  console.warn(`⚠️ Plot Mapper: Unknown plot "${inputName}". Using default location (House).`);
  return DEFAULT_LOCATION;
}
