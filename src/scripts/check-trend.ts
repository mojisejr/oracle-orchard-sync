
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

    const tableData = sortedDates.map(date => {
        const row: any = { Date: date };
        
        // Check Trend Logic (Simple)
        let dailyRiskCount = 0;

        sortedLocations.forEach(loc => {
            const d = pivotData[date][loc];
            if (d) {
                // Get Profile
                const profileKey = Object.keys(ID_TO_PROFILE_KEY).find(id => getPlotName(id) === loc);
                const profile = profileKey ? PLOT_PROFILES[ID_TO_PROFILE_KEY[profileKey]] : undefined;

                const emoji = getStatusEmoji(d.max, d.rh, profile);
                if (emoji !== '🟢') dailyRiskCount++;

                row[loc] = `${emoji} ${Math.round(d.max)}°C`;
            } else {
                row[loc] = '-';
            }
        });

        // Add Summary Column?
        // row['Trend'] = dailyRiskCount > 0 ? `${dailyRiskCount} Risks` : 'Normal';
        return row;
    });

    console.table(tableData);
}

checkWeatherTrend();
