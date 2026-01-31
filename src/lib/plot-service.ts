import { ProfileManager } from './profile-manager';
import { PlotProfile, GrowthStage, SoilType, WaterSourceQuality } from './plot-mapper';

// Re-export common types for consumers
export type { PlotProfile, GrowthStage, SoilType, WaterSourceQuality, PlotPersonality, PlotLocation } from './plot-mapper';

/**
 * Fetch a single plot profile from the ProfileManager (Database backed)
 * This replaces the old synchronous PLOT_PROFILES lookup.
 */
export async function fetchPlotProfile(slug: string): Promise<PlotProfile | null> {
    const manager = ProfileManager.getInstance();
    return manager.getProfile(slug);
}

/**
 * Helper to resolve plot ID from slug or common aliases
 */
export function resolvePlotId(input: string): string | null {
    const slug = input.toLowerCase().trim();
    
    const mapping: Record<string, string> = {
        // New Standard
        'suan_ban': 'suan_ban',
        'suan_makham': 'suan_makham',
        'suan_lang': 'suan_lang',
        'plant_shop': 'plant_shop',
        
        // Thai Aliases
        'บ้าน': 'suan_ban',
        'สวนบ้าน': 'suan_ban',
        'มะขาม': 'suan_makham',
        'สวนมะขาม': 'suan_makham',
        'ล่าง': 'suan_lang',
        'สวนล่าง': 'suan_lang',
        'พันธุ์ไม้': 'plant_shop',
        'ปรัมพันธุ์ไม้': 'plant_shop',

        // Hyphenated (DB/App Script compatibility)
        'suan-ban': 'suan_ban',
        'suan-makham': 'suan_makham',
        'suan-lang': 'suan_lang',
        'plant-shop': 'plant_shop',

        // Legacy Aliases
        'house': 'suan_ban',
        'tamarind': 'suan_makham',
        'lower': 'suan_lang',
        'pram': 'plant_shop'
    };

    return mapping[slug] || null;
}
