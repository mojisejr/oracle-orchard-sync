
import minimist from 'minimist';
import { supabase } from '../lib/supabase';
import { resolvePlotProfile, resolvePlotId, PlotProfile } from '../lib/plot-mapper';
import { calculateGDD, calculateVPD, calculateHargreavesETo } from '../lib/agronomy';

// --- INTERFACES ---

interface WeatherForecast {
  location_id: string;
  forecast_date: string;
  tc_max: number;
  tc_min: number;
  rh_percent: number;
  rain_prob_percent: number;
}

interface ActivityLog {
  id: number;
  activity_date: string;
  activity_type: string;
  plot_id: string;
  notes: string;
}

interface PlotSITREP {
  profile: {
    stage: string;
    soil: string;
    personality: string;
  };
  metrics: {
    gdd_accumulated: number;
  };
  forecasts: {
    date: string;
    temp_max: number;
    temp_min: number;
    rh: number;
    rain_prob: number;
    vpd: number;
    eto: number;
  }[];
  recent_activities: {
    date: string;
    action: string;
    notes: string;
  }[];
  pending_tasks: {
    id: number;
    action: string;
    due_date: string;
    notes: string;
  }[];
}

interface GapAnalysis {
    integrity: 'fresh' | 'stale' | 'critical';
    last_update_hours: number;
    missing_plots: string[];
    external_search_needed: boolean;
    notes: string[];
}

interface SITREP {
  timestamp: string;
  meta: {
      horizon_days: number;
      focus: string[];
  };
  gap_analysis: GapAnalysis;
  plots: Record<string, PlotSITREP>;
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

  // Note: We do NOT filter by location_id in SQL because DB might use aliases (suan-makham)
  // while we request canonical IDs (tamarind). We filter in memory after resolution.

  const { data: forecastsRaw, error: weatherError } = await forecastQuery;

  if (weatherError) {
    console.error('❌ Error fetching forecasts:', weatherError);
    process.exit(1);
  }

  const forecasts = forecastsRaw || [];

  // Group Forecasts
  const forecastsByLocation: Record<string, WeatherForecast[]> = {};
  forecasts.forEach((row: any) => {
    const locId = resolvePlotId(row.location_id) || row.location_id;
    
    // Filter if requested (Hybrid filtering to handle alias mismatch)
    if (requestedPlots.length > 0 && !requestedPlots.includes(locId)) return;

    if (!forecastsByLocation[locId]) {
        forecastsByLocation[locId] = [];
    }
    // Dedupe
    const exists = forecastsByLocation[locId].find(f => f.forecast_date === row.forecast_date);
    if (!exists) {
        forecastsByLocation[locId].push(row);
    }
  });

  // 3. Fetch Recent Activities (History)
  // We fetch a bit more to ensure we cover all plots, then filter in memory
  const { data: logs, error: logsError } = await supabase
    .from('activity_logs')
    .select('id, created_at, activity_type, plot_name, notes')
    .order('created_at', { ascending: false })
    .limit(100);

  if (logsError) {
    console.error('❌ Error fetching activity logs:', logsError);
  }

  const logsByLocation: Record<string, ActivityLog[]> = {};
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

  // Check 1: Forecast Freshness (Is the closest forecast today or yesterday?)
  if (forecasts.length > 0) {
      // forecasts are ordered by date asc. First one should be today or close.
      const firstDate = new Date(forecasts[0].forecast_date);
      const diffHours = (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60);
      gapAnalysis.last_update_hours = Math.floor(diffHours);

      // If simplest forecast is older than 24h + 1 day (allow some buffer for "today" match)
      // Actually, if we query GTE today, we shouldn't get old data. 
      // But if result is empty, that means NO data for today.
  } else {
      gapAnalysis.integrity = 'stale';
      gapAnalysis.notes.push('No forecast data found for the requested period.');
      gapAnalysis.external_search_needed = true;
  }

  // Check 2: Plot Coverage
  if (requestedPlots.length > 0) {
      const foundPlots = Object.keys(forecastsByLocation);
      const missing = requestedPlots.filter((p: string) => !foundPlots.includes(p));
      if (missing.length > 0) {
          gapAnalysis.missing_plots = missing;
          gapAnalysis.notes.push(`Missing forecast for plots: ${missing.join(', ')}`);
          // If missing requested plot, we might need search IF we expect it to exist.
          // But maybe it's just not in DB? For now, flag as missing.
      }
  }

  // Check 3: Log Stale-ness (Bonus)
  // Determine if we haven't logged in a long time for requested plots
  const plotsToCheck = requestedPlots.length > 0 ? requestedPlots : Object.keys(forecastsByLocation);
  plotsToCheck.forEach((pid: string) => {
      const pLogs = logsByLocation[pid] || [];
      if (pLogs.length === 0) {
           gapAnalysis.notes.push(`No recent activity logs for ${pid} (History Gap).`);
      } else {
          const lastLog = new Date(pLogs[0].activity_date);
          const daysSince = (now.getTime() - lastLog.getTime()) / (1000 * 3600 * 24);
          if (daysSince > 7) {
              gapAnalysis.notes.push(`Activity logs for ${pid} are older than 7 days.`);
          }
      }
  });
  
  if (gapAnalysis.missing_plots.length > 0 || gapAnalysis.notes.length > 0) {
      if (gapAnalysis.integrity === 'fresh') gapAnalysis.integrity = 'stale'; // Downgrade if gaps found
  }


  // 5. Build SITREP
  const sitrep: SITREP = {
    timestamp: now.toISOString(),
    meta: {
        horizon_days: horizonDays,
        focus: requestedPlots.length > 0 ? requestedPlots : ['all']
    },
    gap_analysis: gapAnalysis,
    plots: {}
  };

  // Determine which plots to include in output
  // We use the union of plots found in Forecasts OR Logs OR Pending
  const allInvolvedPlots = new Set([
      ...Object.keys(forecastsByLocation),
      ...Object.keys(logsByLocation),
      ...Object.keys(pendingByLocation)
  ]);
  
  // If user requested specific plots, we strictly follow that (already handled by filtering logic above, but double check)
  const targetPlots = requestedPlots.length > 0 
      ? requestedPlots 
      : Array.from(allInvolvedPlots);

  for (const locId of targetPlots) {
    const locForecasts = forecastsByLocation[locId] || [];
    
    // Resolve Context
    const profile = resolvePlotProfile(locId); // Returns default if not found
    
    // Calculate Metrics
    let gddSum = 0;
    
    const enrichedForecasts = locForecasts.map(f => {
        const tMean = (f.tc_max + f.tc_min) / 2;
        const vpdVal = calculateVPD(tMean, f.rh_percent);
        const gdd = calculateGDD(f.tc_max, f.tc_min);
        gddSum += gdd;
        const eto = calculateHargreavesETo(f.tc_max, f.tc_min, profile.lat, new Date(f.forecast_date));

        return {
            date: f.forecast_date,
            temp_max: f.tc_max,
            temp_min: f.tc_min,
            rh: f.rh_percent,
            rain_prob: f.rain_prob_percent,
            vpd: Number(vpdVal.toFixed(2)),
            eto: Number(eto.toFixed(2))
        };
    });

    const plotLogs = logsByLocation[locId] || [];
    const formattedLogs = plotLogs.map(l => ({
        date: l.activity_date,
        action: l.activity_type,
        notes: l.notes
    }));

    const plotTasks = pendingByLocation[locId] || [];
    const formattedTasks = plotTasks.map(t => ({
      id: t.id,
      action: t.next_action?.action || t.activity_type,
      due_date: t.next_action?.date || t.created_at,
      notes: t.notes
    }));

    sitrep.plots[locId] = {
        profile: {
            stage: profile.stage,
            soil: profile.soil,
            personality: profile.personality?.notes || 'Standard'
        },
        metrics: {
            gdd_accumulated: Number(gddSum.toFixed(2))
        },
        forecasts: enrichedForecasts,
        recent_activities: formattedLogs,
        pending_tasks: formattedTasks
    };
  }

  // 6. Output
  console.log(JSON.stringify(sitrep, null, 2));
}

runSynthesis().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
