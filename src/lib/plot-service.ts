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
 * Helper to resolve plot ID from slug (Legacy map support if needed)
 * For now, assume slug IS the id.
 */
export function resolvePlotId(slug: string): string {
    return slug.toLowerCase();
}
