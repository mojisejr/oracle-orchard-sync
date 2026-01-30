export interface PlotLocation {
  lat: number;
  lon: number;
  name_th: string;
}

export type GrowthStage = 'preparing_leaf' | 'induction' | 'bloom' | 'fruit_set' | 'harvest' | 'seedling';
export type SoilType = 'sandy' | 'loamy' | 'loamy_sandy' | 'clayey' | 'clayey_filled';
export type WaterSourceQuality = 'normal' | 'high_manganese_iron' | 'clean_mountain' | 'brackish';

export interface PlotPersonality {
    sensitivity_drought: number; // 0-10 (10 = Dies immediately)
    sensitivity_flood: number;   // 0-10 (10 = Rot immediately)
    critical_asset: 'durian' | 'mangosteen' | 'showcase' | 'mixed';
    notes: string;
}

export interface PlotProfile extends PlotLocation {
  stage: GrowthStage;
  soil: SoilType;
  water: WaterSourceQuality;
  personality: PlotPersonality;
}

// NOTE: Hardcoded PLOT_PROFILES has been removed.
// Use src/lib/profile-manager.ts or src/lib/plot-service.ts instead.
