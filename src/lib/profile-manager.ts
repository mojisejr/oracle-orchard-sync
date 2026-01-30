import { supabase } from './supabase';
import { PlotProfile, GrowthStage, SoilType, WaterSourceQuality } from './plot-mapper';

// Database Row Interface (Matches SQL Schema)
interface DBPlotProfile {
    slug: string;
    name_th: string;
    lat: number;
    lon: number;
    stage: string;
    soil_type: string;
    water_source: string;
    sensitivity_drought: number;
    sensitivity_flood: number;
    critical_asset: string | null;
    notes: string | null;
    updated_at: string;
}

// Fallback Data (Safety Net - copy of original hardcoded data)
const FALLBACK_PROFILES: Record<string, PlotProfile> = {
    'house': {
        lat: 12.552967,
        lon: 102.155557,
        name_th: 'สวนบ้าน',
        stage: 'bloom',
        soil: 'loamy_sandy',
        water: 'clean_mountain',
        personality: {
            sensitivity_drought: 9,
            sensitivity_flood: 3,
            critical_asset: 'showcase',
            notes: 'หน้าร้าน/จุดรับแขก ห้ามโทรมเด็ดขาด (Nursery Zone) [FALLBACK]'
        }
    },
    'tamarind': {
        lat: 12.658602,
        lon: 102.204633,
        name_th: 'สวนมะขาม',
        stage: 'bloom',
        soil: 'sandy',
        water: 'high_manganese_iron',
        personality: {
            sensitivity_drought: 10,
            sensitivity_flood: 2,
            critical_asset: 'durian',
            notes: 'ไข่ในหิน (Crown Jewel). ห้ามขาดน้ำ เกษตรประณีต [FALLBACK]'
        }
    },
    'lower': {
        lat: 12.546194,
        lon: 102.140010,
        name_th: 'สวนล่าง',
        stage: 'preparing_leaf',
        soil: 'clayey_filled',
        water: 'normal',
        personality: {
            sensitivity_drought: 4,
            sensitivity_flood: 8,
            critical_asset: 'mangosteen',
            notes: 'ปราการด่านสุดท้าย (The Fortress). ถึกทน แต่ระวังน้ำท่วม [FALLBACK]'
        }
    },
    'pram': {
        lat: 12.552967,
        lon: 102.155557,
        name_th: 'แปลงพันธุ์ไม้',
        stage: 'seedling',
        soil: 'loamy_sandy',
        water: 'clean_mountain',
        personality: {
            sensitivity_drought: 9,
            sensitivity_flood: 5,
            critical_asset: 'showcase',
            notes: 'ต้นกล้าอ่อนแอ ห้ามแห้ง ห้ามแฉะเกิน [FALLBACK]'
        }
    }
};

export class ProfileManager {
    private static instance: ProfileManager;
    private cache: Record<string, PlotProfile> = {};
    private lastFetch: number = 0;
    private readonly CACHE_TTL = 30000; // 30 seconds

    private constructor() {}

    public static getInstance(): ProfileManager {
        if (!ProfileManager.instance) {
            ProfileManager.instance = new ProfileManager();
        }
        return ProfileManager.instance;
    }

    /**
     * Fetch all profiles from DB (or cache/fallback)
     */
    public async getAllProfiles(forceRefresh = false): Promise<Record<string, PlotProfile>> {
        const now = Date.now();
        if (!forceRefresh && this.lastFetch > 0 && (now - this.lastFetch < this.CACHE_TTL)) {
            // console.log('🧠 ProfileManager: Returning cached profiles');
            return this.cache;
        }

        try {
            // console.log('🧠 ProfileManager: Fetching from Supabase...');
            const { data, error } = await supabase
                .from('plot_profiles')
                .select('*');

            if (error) throw error;

            if (!data || data.length === 0) {
                console.warn('⚠️ ProfileManager: DB empty or unreachable. Using Falback.');
                return FALLBACK_PROFILES;
            }

            const mappedProfiles: Record<string, PlotProfile> = {};
            
            data.forEach((row: DBPlotProfile) => {
                mappedProfiles[row.slug] = this.mapDBToProfile(row);
            });

            this.cache = mappedProfiles;
            this.lastFetch = now;
            console.log(`✅ ProfileManager: Loaded ${Object.keys(this.cache).length} profiles from DB.`);
            
            return this.cache;

        } catch (err: any) {
            console.error('❌ ProfileManager Error:', err.message);
            console.warn('⚠️ ProfileManager: Reverting to FALLBACK due to error.');
            return FALLBACK_PROFILES;
        }
    }

    public async getProfile(slug: string): Promise<PlotProfile | null> {
        const profiles = await this.getAllProfiles();
        return profiles[slug] || null;
    }

    private mapDBToProfile(row: DBPlotProfile): PlotProfile {
        // Validate/Cast Enums safely
        // In a real strict environment we would validate 'stage' against GrowthStage array
        const stage = row.stage as GrowthStage; 
        const soil = row.soil_type as SoilType;
        const water = row.water_source as WaterSourceQuality;
        const asset = (row.critical_asset || 'mixed') as any;

        return {
            name_th: row.name_th,
            lat: row.lat,
            lon: row.lon,
            stage: stage,
            soil: soil,
            water: water,
            personality: {
                sensitivity_drought: row.sensitivity_drought,
                sensitivity_flood: row.sensitivity_flood,
                critical_asset: asset,
                notes: row.notes || ''
            }
        };
    }
}
