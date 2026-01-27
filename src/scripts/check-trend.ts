
import { supabase } from '../lib/supabase';
import { PLOT_PROFILES, PlotProfile } from '../lib/plot-mapper';

// Mapping Supabase Location IDs (strings) to PlotMapper Keys
const ID_TO_PROFILE_KEY: Record<string, string> = {
    'suan-ban': 'house',
    'suan-makham': 'tamarind',
    'suan-lang': 'lower',
    'pram': 'pram'
};

function getPlotName(id: string): string {
    const key = ID_TO_PROFILE_KEY[id];
    if (key && PLOT_PROFILES[key]) {
        // "Suan Ban", "Suan Makham"
        // Convert "suan-ban" -> "Suan Ban"
        return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return id; // Fallback
}

function getStatusEmoji(temp: number, rh: number | undefined, profile?: PlotProfile): string {
    // 1. Extreme Heat (Universal)
    if (temp >= 36) return '🔴'; // Danger!
    
    // 2. Personality-Based Logic
    if (profile) {
        const { sensitivity_drought } = profile.personality;
        
        // High Sensitivity (e.g. Tamarind, Nursery)
        if (sensitivity_drought >= 9) {
            if (temp >= 34) return '🟡'; // Warning early
            if (rh !== undefined && rh < 55) return '🟡'; // Dry warning
        }

        // Moderate Sensitivity (e.g. Mangosteen)
        if (sensitivity_drought < 5) {
             if (temp >= 35) return '🟡'; // Standard warning
        }
    }

    return '🟢';
}

async function checkWeatherTrend() {
    console.log('--- 🌡️  Orchard Trend Intelligence (Personality Aware) ---');
    console.log('Fetching forecast data...');

    // Select distinct locations first? No, just grab all forecasts and pivot in memory.
    // Need rh_percent for Logic
    const { data: rawData, error } = await supabase
        .from('weather_forecasts')
        .select('location_id, forecast_date, tc_min, tc_max, rh_percent')
        .order('forecast_date', { ascending: true });

    if (error) {
        console.error('❌ Error fetching forecasts:', error);
        return;
    }

    if (!rawData || rawData.length === 0) {
        console.log('No forecast data found.');
        return;
    }

    // Pivot Data: Map<Date, Record<Location, Data>>
    const pivotData: Record<string, Record<string, { min: number, max: number, rh: number }>> = {};
    const allLocations = new Set<string>();

    rawData.forEach((row: any) => {
        const date = row.forecast_date;
        const locId = row.location_id;
        const plotName = getPlotName(locId);
        
        allLocations.add(plotName);

        if (!pivotData[date]) {
            pivotData[date] = {};
        }

        // If multiple entries per day (shouldn't be for same location), take the latest or aggreg. 
        // Assuming unique constraint on (location_id, forecast_date).
        pivotData[date][plotName] = {
            min: row.tc_min,
            max: row.tc_max,
            rh: row.rh_percent
        };
    });

    // Formatting Output
    const sortedDates = Object.keys(pivotData).sort().slice(0, 10); // Next 10 days
    const sortedLocations = Array.from(allLocations).sort();

    // Data structure for Trend Analysis
    const trendHistory: Record<string, { max: number, rh: number, emoji: string }[]> = {};
    sortedLocations.forEach(loc => trendHistory[loc] = []);

    const tableData = sortedDates.map(date => {
        const row: any = { Date: date };
        
        sortedLocations.forEach(loc => {
            const d = pivotData[date][loc];
            if (d) {
                // Get Profile
                const profileKey = Object.keys(ID_TO_PROFILE_KEY).find(id => getPlotName(id) === loc);
                const profile = profileKey ? PLOT_PROFILES[ID_TO_PROFILE_KEY[profileKey]] : undefined;

                const emoji = getStatusEmoji(d.max, d.rh, profile);
                row[loc] = `${emoji} ${Math.round(d.max)}°C (RH:${Math.round(d.rh)}%)`;
                
                // Collect for Analysis
                trendHistory[loc].push({ max: d.max, rh: d.rh, emoji });
            } else {
                row[loc] = '-';
            }
        });

        return row;
    });

    console.table(tableData);

    // --- Phase 3: Intelligence Injection (Nudges) ---
    console.log('\n--- 🧠 Orchard Sage Nudges ---');
    const nudges: string[] = [];

    // 1. Suan Makham (Sandy Soil) - Heat Accumulation Warning
    // Logic: If '🟡' or '🔴' for 2 consecutive days
    const makhamData = trendHistory['Suan Makham'];
    if (makhamData) {
        let consecutiveRisk = 0;
        makhamData.forEach(day => {
            if (day.emoji === '🟡' || day.emoji === '🔴') consecutiveRisk++;
            else consecutiveRisk = 0;
        });
        
        if (consecutiveRisk >= 2) {
            nudges.push(`⚠️  **Suan Makham**: ดินทรายอมความร้อนสะสม ${consecutiveRisk} วันแล้ว ระวังรากแห้งตาย (Drought Risk)`);
        }
    }

    // 2. Suan Ban (Nursery) - Water Loss Warning
    // Logic: If RH < 50% for 3 consecutive days
    const banData = trendHistory['Suan Ban'];
    if (banData) {
        let consecutiveDry = 0;
        banData.forEach(day => {
            if (day.rh < 55) consecutiveDry++;
            else consecutiveDry = 0;
        });

        if (consecutiveDry >= 3) {
            nudges.push(`💧 **Suan Ban**: ความชื้นต่ำต่อเนื่อง ${consecutiveDry} วัน (RH < 55%) ไม้อนุบาลอาจเสียน้ำจนชะงัก`);
        }
    }

    // 3. Suan Lang (Clayey) - Flood/Rot Risk (Opposite check)
    // Logic: If RH > 90% for 3 days
    const langData = trendHistory['Suan Lang'];
    if (langData) {
        let consecutiveWet = 0;
        langData.forEach(day => {
            if (day.rh > 90) consecutiveWet++;
            else consecutiveWet = 0;
        });
        
        if (consecutiveWet >= 3) {
            nudges.push(`🍄 **Suan Lang**: ความชื้นสูงสะสม ${consecutiveWet} วัน ระวังเชื้อราในมังคุด`);
        }
    }

    if (nudges.length > 0) {
        nudges.forEach(n => console.log(n));
    } else {
        console.log('✅ No critical trends detected. Keep monitoring.');
    }
}

checkWeatherTrend();
