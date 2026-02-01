
import minimist from 'minimist';
import { supabase } from '../lib/supabase';
import { fetchPlotProfile } from '../lib/plot-service';
import { resolvePlotId } from '../lib/plot-service';
import { calculateGDD, calculateVPD, calculateHargreavesETo } from '../lib/agronomy';
import { generateManifest } from '../lib/manifest-generator'; // Phase 2: Brain Hook
import { 
  WeatherForecastDB, 
  SITREP, 
  DailyMetData, 
  ActivityContext,
  OrchardPlot 
} from '../types/orchard-core';

// --- INTERFACES ---

// Local System Wrapper (The "Envelope" for multiple SITREPs)
interface SystemInsight {
  timestamp: string;
  meta: {
      horizon_days: number;
      focus: string[];
  };
  gap_analysis: GapAnalysis;
  plots: Record<string, SITREP>;
}

interface GapAnalysis {
    integrity: 'fresh' | 'stale' | 'critical';
    last_update_hours: number;
    missing_plots: string[];
    external_search_needed: boolean;
    notes: string[];
}

// --- MAIN FUNCTION ---

async function runSynthesis() {
  const args = minimist(process.argv.slice(2), {
      string: ['plot', 'mode'],
      default: {
          days: 3,
          plot: 'all', // 'all' or comma-separated 'suan-ban,house'
          mode: 'standard'
      }
  });

  const horizonDays = parseInt(String(args.days));
  const requestedPlots = args.plot === 'all' 
      ? [] 
      : args.plot.split(',').map((p: string) => p.trim());

  // 1. Prepare Dates (Rolling Window)
  const now = new Date();
  const startDate = now.toISOString().split('T')[0];
  const endDateObj = new Date();
  endDateObj.setDate(now.getDate() + horizonDays);
  const endDate = endDateObj.toISOString().split('T')[0];

  // 2. Fetch Forecasts (Future)
  let forecastQuery = supabase
    .from('weather_forecasts')
    .select('*')
    .gte('forecast_date', startDate)
    .lte('forecast_date', endDate)
    .order('forecast_date', { ascending: true });

  const { data: forecastsRaw, error: weatherError } = await forecastQuery;

  if (weatherError) {
    console.error('❌ Error fetching forecasts:', weatherError);
    process.exit(1);
  }

  const forecasts = forecastsRaw || [];

  // Group Forecasts
  const forecastsByLocation: Record<string, WeatherForecastDB[]> = {};
  forecasts.forEach((row: any) => {
    const locId = resolvePlotId(row.location_id) || row.location_id;
    
    // Filter if requested
    if (requestedPlots.length > 0 && !requestedPlots.includes(locId)) return;

    if (!forecastsByLocation[locId]) {
        forecastsByLocation[locId] = [];
    }
    // Dedupe
    const exists = forecastsByLocation[locId].find((f: WeatherForecastDB) => f.forecast_date === row.forecast_date);
    if (!exists) {
        forecastsByLocation[locId].push(row);
    }
  });

  // 3. Fetch Recent Activities (History)
  const { data: logs, error: logsError } = await supabase
    .from('activity_logs')
    .select('id, created_at, activity_type, plot_name, notes')
    .order('created_at', { ascending: false })
    .limit(100);

  if (logsError) {
    console.error('❌ Error fetching activity logs:', logsError);
  }

  const logsByLocation: Record<string, any[]> = {};
  (logs || []).forEach((log: any) => {
    const plotId = resolvePlotId(log.plot_name) || 'unknown';
    if (plotId === 'unknown') return;
    
    // Filter if requested
    if (requestedPlots.length > 0 && !requestedPlots.includes(plotId)) return;

    if (!logsByLocation[plotId]) logsByLocation[plotId] = [];
    // Keep last 5 logs per plot
    if (logsByLocation[plotId].length < 5) {
        logsByLocation[plotId].push({
            id: log.id,
            activity_date: log.created_at,
            activity_type: log.activity_type,
            plot_id: plotId,
            notes: log.notes
        });
    }
  });

  // 3.5 Fetch Pending Tasks
  const { data: pendingLogs, error: pendingError } = await supabase
    .from('activity_logs')
    .select('id, activity_type, plot_name, notes, next_action, created_at')
    .eq('next_action->>status', 'pending')
    .order('created_at', { ascending: true });

  if (pendingError) {
      console.error('❌ Error fetching pending tasks:', pendingError);
  }

  const pendingByLocation: Record<string, any[]> = {};
  (pendingLogs || []).forEach((task: any) => {
      const plotId = resolvePlotId(task.plot_name) || 'unknown';
      if (plotId === 'unknown') return;

      // Filter if requested
      if (requestedPlots.length > 0 && !requestedPlots.includes(plotId)) return;

      if (!pendingByLocation[plotId]) pendingByLocation[plotId] = [];
      pendingByLocation[plotId].push(task);
  });

  // 4. Gap Analysis
  const gapAnalysis: GapAnalysis = {
      integrity: 'fresh',
      last_update_hours: 0,
      missing_plots: [],
      external_search_needed: false,
      notes: []
  };

  if (forecasts.length > 0) {
      const firstDate = new Date(forecasts[0].forecast_date);
      const diffHours = (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60);
      gapAnalysis.last_update_hours = Math.floor(diffHours);
  } else {
      gapAnalysis.integrity = 'stale';
      gapAnalysis.notes.push('No forecast data found for the requested period.');
      gapAnalysis.external_search_needed = true;
  }

  if (requestedPlots.length > 0) {
      const foundPlots = Object.keys(forecastsByLocation);
      const missing = requestedPlots.filter((p: string) => !foundPlots.includes(p));
      if (missing.length > 0) {
          gapAnalysis.missing_plots = missing;
          gapAnalysis.notes.push(`Missing forecast for plots: ${missing.join(', ')}`);
      }
  }

  // 5. Build System Report
  const systemReport: SystemInsight = {
    timestamp: now.toISOString(),
    meta: {
        horizon_days: horizonDays,
        focus: requestedPlots.length > 0 ? requestedPlots : ['all']
    },
    gap_analysis: gapAnalysis,
    plots: {}
  };

  const allInvolvedPlots = new Set([
      ...Object.keys(forecastsByLocation),
      ...Object.keys(logsByLocation),
      ...Object.keys(pendingByLocation)
  ]);
  
  const targetPlots = requestedPlots.length > 0 
      ? requestedPlots 
      : Array.from(allInvolvedPlots);

  for (const locId of targetPlots) {
    let locForecasts = forecastsByLocation[locId] || [];

    // Fallback: If no forecast for this plot, try to use regional weather (e.g., plant_shop -> suan_ban)
    if (locForecasts.length === 0) {
        if (locId === 'plant_shop') {
            locForecasts = forecastsByLocation['suan_ban'] || [];
            console.warn(`ℹ️  Regional Mapping: using suan_ban weather for ${locId}`);
        }
    }
    
    // Resolve Context (ASYNC FETCH)
    const profile = await fetchPlotProfile(locId); 
    
    if (!profile) {
        console.warn(`⚠️  Skip plot ${locId}: No Profile found.`);
        continue;
    }
    
    // Calculate Metrics
    let gddSum = 0;
    
    const enrichedForecasts: DailyMetData[] = locForecasts.map(f => {
        const tMean = (f.tc_max + f.tc_min) / 2;
        const vpdVal = calculateVPD(tMean, f.rh_percent);
        const gdd = calculateGDD(f.tc_max, f.tc_min);
        gddSum += gdd;
        const eto = calculateHargreavesETo(f.tc_max, f.tc_min, profile.lat, new Date(f.forecast_date));
        // Use 0 as default if rain_prob is missing, but capture rain_mm which is more reliable in current DB
        return {
            date: f.forecast_date,
            tempMax: f.tc_max,
            tempMin: f.tc_min,
            humidity: f.rh_percent,
            rainProb: f.rain_prob_percent || 0, 
            rainMm: f.rain_mm || 0,
            vpd: Number(vpdVal.toFixed(2)),
            gdd: Number(gdd.toFixed(2)),
            eto: Number(eto.toFixed(2))
        };
    });

    // Determine current weather (Today or First Forecast)
    let currentMet: DailyMetData = enrichedForecasts.find(f => f.date === startDate) || enrichedForecasts[0] || {
        date: startDate,
        tempMax: 0,
        tempMin: 0,
        humidity: 0,
        rainProb: 0,
        vpd: 0,
        gdd: 0,
        eto: 0
    };

    const plotLogs: ActivityContext[] = (logsByLocation[locId] || []).map(l => ({
        date: l.activity_date,
        type: l.activity_type,
        notes: l.notes
    }));

    const plotTasks: ActivityContext[] = (pendingByLocation[locId] || []).map(t => ({
      date: t.next_action?.date || t.created_at,
      type: t.next_action?.action || t.activity_type,
      notes: `${t.notes || ''} [PENDING ID:${t.id}]`
    }));

    // Construct the Standard SITREP
    const sitrep: SITREP = {
        timestamp: new Date().toISOString(),
        plot: {
            id: locId,
            profile: profile
        },
        environment: {
            history: [], // Not fetching history yet in this phase
            current: currentMet,
            forecast: enrichedForecasts
        },
        activities: {
            recent: plotLogs,
            planned: plotTasks,
            gapAnalysis: [] 
        },
        insight: {
            status: 'nominal', // Default
            headlines: []
        }
    };
    
    // Simple Insight Logic (Phase 1 placeholder)
    if (gddSum > 30) {
        sitrep.insight?.headlines.push(`High Growth Expected (GDD: ${gddSum.toFixed(1)})`);
    }

    systemReport.plots[locId] = sitrep;
  }

  // 6. Output
  const isJson = args.mode === 'json' || args.json === true;
  const asManifest = args.manifest === true;

  if (isJson) {
      if (asManifest) {
          // Phase 2: Headless Output (Brain -> Manifest)
          const manifest = generateManifest(systemReport);
          console.log(JSON.stringify(manifest, null, 2));
      } else {
          // Legacy Output (Phase 1: Brain -> Data)
          console.log(JSON.stringify(systemReport, null, 2));
      }
  } else {
      console.log(`\n🌱 SYSTEM INSIGHT REPORT [${now.toISOString()}]`);
      console.log(`   Period: ${startDate} -> ${endDate} (${horizonDays} days)`);
      if (gapAnalysis.integrity !== 'fresh') {
          console.log(`   ⚠️  Integrity: ${gapAnalysis.integrity.toUpperCase()}`);
          gapAnalysis.notes.forEach(n => console.log(`      - ${n}`));
      }

      Object.values(systemReport.plots).forEach(p => {
          console.log(`\n----------------------------------------`);
          console.log(`📍 ${p.plot.id.toUpperCase()} (${p.plot.profile.name_th})`);
          console.log(`   Role: ${p.plot.profile.personality.critical_asset} | Soil: ${p.plot.profile.soil}`);
          console.log(`   🌡  Current: ${p.environment.current.tempMax}°C / ${p.environment.current.vpd} kPa`);
          console.log(`   🔮 Forecasts:`);
          p.environment.forecast.forEach(f => {
              console.log(`      [${f.date}] Max ${f.tempMax}°C | Rain ${f.rainProb}% | VPD ${f.vpd}`);
          });
          
          if (p.activities.recent.length > 0) {
              console.log(`   🚜 Recent Activity:`);
              p.activities.recent.forEach(a => console.log(`      - ${a.date}: ${a.type} (${a.notes})`));
          }
          if (p.activities.planned && p.activities.planned.length > 0) {
              console.log(`   📌 Continuous/Pending:`);
              p.activities.planned.forEach(a => console.log(`      - ${a.date}: ${a.type} ${a.notes}`));
          }
      });
      console.log(`\n----------------------------------------`);
  }
}

runSynthesis().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
