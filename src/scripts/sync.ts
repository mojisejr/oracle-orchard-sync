import { supabase } from '../lib/supabase';
import { ActivityLog } from '../types/database';
import { WeatherService } from '../lib/weather';
import { resolvePlotLocation } from '../lib/plot-mapper';
import { WeatherStamp } from '../types/weather';
import * as fs from 'fs';
import * as path from 'path';

// Define the path to the farming logs directory
// Going up from src/scripts -> projects/orchard-sync -> projects -> root -> ψ/memory/logs/farming/
const FARMING_LOGS_DIR = path.resolve(__dirname, '../../../../ψ/memory/logs/farming');

async function main() {
  console.log('🍎 Starting Orchard Sync...');

  // Initialize Weather Service
  const weatherService = new WeatherService();

  // 1. Determine "Today" (Local Time - GMT+7 awareness)
  // We want to fetch logs created "today" relative to the user's local time.
  const now = new Date();
  const dateString = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
  
  const startOfDay = new Date(dateString + 'T00:00:00+07:00').toISOString();
  const endOfDay = new Date(dateString + 'T23:59:59+07:00').toISOString();

  console.log(`📅 Syncing logs for: ${dateString}`);
  console.log(`   Time range: ${startOfDay} - ${endOfDay}`);

  // 2. Fetch data from Supabase
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('*')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching logs:', error.message);
    process.exit(1);
  }

  if (!logs || logs.length === 0) {
    console.log('ℹ️ No activity logs found for today.');
    // We might still want to create the file or just exit. 
    // For now, let's exit to avoid empty files if that's preferred, 
    // OR create an empty placeholder. Let's creating nothing for now.
    return;
  }

  console.log(`✅ Found ${logs.length} activities.`);

  // 3. Group by Plot Name (Orchard Name)
  // We create one file per Orchard per Day: YYYY-MM-DD_[plot_name].md
  const logsByPlot: Record<string, ActivityLog[]> = {};

  (logs as ActivityLog[]).forEach((log) => {
    const plot = log.plot_name || 'unknown-plot';
    if (!logsByPlot[plot]) {
      logsByPlot[plot] = [];
    }
    logsByPlot[plot].push(log);
  });

  // 4. Generate Markdown Files
  // Ensure directory exists
  if (!fs.existsSync(FARMING_LOGS_DIR)) {
    console.log(`📁 Creating directory: ${FARMING_LOGS_DIR}`);
    fs.mkdirSync(FARMING_LOGS_DIR, { recursive: true });
  }

  for (const [plotName, plotLogs] of Object.entries(logsByPlot)) {
    // Sanitize plot name for filename (Keep Thai characters, replace spaces and risky chars)
    const safePlotName = plotName.replace(/[/\s?%*:|"<>]/g, '-').toLowerCase();
    const filename = `${dateString}_${safePlotName}.md`;
    const filePath = path.join(FARMING_LOGS_DIR, filename);

    // Weather Integration
    const location = resolvePlotLocation(plotName);
    console.log(`🌤️ Fetching weather for ${plotName} (Lat: ${location.lat}, Lon: ${location.lon})...`);
    
    let weatherStamps: WeatherStamp[] = [];
    try {
      weatherStamps = await weatherService.getHourlyForecast(location.lat, location.lon);
    } catch (e) {
      console.warn(`⚠️ Could not fetch weather for ${plotName}`);
    }

    const fileContent = generateMarkdown(dateString, plotName, plotLogs, weatherService, weatherStamps, location.name_th);

    // Write file (Synchronous for safety)
    try {
      // Check if file exists to determine if we are updating or creating
      // Actually, since we pulled *all* logs for today, we probably want to overwrite 
      // the day's file to ensure it reflects the DB state exactly (Source of Truth).
      // Or we can append? 
      // The requirement says "Append/Create".
      // If we run this script multiple times a day, "Append" might duplicate entries if we aren't careful.
      // Strategy: Re-generate the *entire day's* log based on DB state. This is cleaner and idempotent.
      fs.writeFileSync(filePath, fileContent, 'utf8');
      console.log(`📝 Updated log: ${filePath}`);

      // --- PHASE 1: TERMINAL VISIBILITY ---
      // Show Summary Table for this Plot
      const currentStamp = weatherStamps.length > 0 ? weatherService.findClosestStamp(weatherStamps, new Date())?.stamp : null;
      const startIndex = currentStamp ? weatherStamps.indexOf(currentStamp) : 0;
      const advices = weatherService.generateAdvice(weatherStamps, startIndex);

      if (currentStamp) {
        // Filter important advices for terminal (Danger/Warning) or show all
        const criticalAdvice = advices
          .filter(a => a.status !== 'safe')
          .map(a => `[${a.status.toUpperCase()}] ${a.message}`)
          .join(' | ');

        console.log(`\n📊 Status Report: ${location.name_th} (${plotName})`);
        console.table([{
          Temp: `${currentStamp.temp_c}°C`,
          Humidity: `${currentStamp.humidity_percent}%`,
          Rain4h: `${advices.find(a => a.condition.includes('พ่นยา'))?.message || '-'}`,
          OracleAdvice: criticalAdvice || '✅ Normal (No Alerts)'
        }]);
        console.log('---------------------------------------------------');
      }

    } catch (err) {
      console.error(`❌ Failed to write file for ${plotName}:`, err);
    }
  }

  console.log('✨ Sync Completed.');
}

function generateMarkdown(
  date: string, 
  plotName: string, 
  logs: ActivityLog[],
  weatherService: WeatherService,
  weatherStamps: WeatherStamp[],
  locationName: string
): string {
  // Group details by activity type for better readability
  const groupedLogs: Record<string, ActivityLog[]> = {};
  logs.forEach(log => {
    if (!groupedLogs[log.activity_type]) groupedLogs[log.activity_type] = [];
    groupedLogs[log.activity_type].push(log);
  });

  let md = `# 🍎 Daily Farming Log: ${plotName}\n\n`;
  md += `**Date**: ${date}\n`;
  md += `**Total Activities**: ${logs.length}\n`;
  md += `**Generated By**: Orchard-Sync Engine\n\n`;
  md += `---\n\n`;

  for (const [type, activities] of Object.entries(groupedLogs)) {
    const icon = getActivityIcon(type);
    md += `## ${icon} ${capitalize(type)}\n\n`;
    
    activities.forEach(log => {
      const time = new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      md += `- **${time}**: ${log.notes || 'No notes'}\n`;
      
      // Render details based on type
      if (log.details && Object.keys(log.details).length > 0) {
        md += `  - *Details*: ${formatDetails(log.details)}\n`;
      }
      
      if (log.tree_id) {
        md += `  - *Tree*: \`${log.tree_id}\`\n`;

      // Weather Stamp Integration
      if (weatherStamps.length > 0) {
        const logDate = new Date(log.created_at);
        const match = weatherService.findClosestStamp(weatherStamps, logDate);
        
        if (match) {
          const advice = weatherService.generateAdvice(weatherStamps, match.index);
          const upcoming = weatherStamps.slice(match.index, match.index + 4);
          const rainNext4h = upcoming.reduce((sum, s) => sum + s.rain_mm, 0);
          
          const stampMd = weatherService.formatMarkdown(locationName, match.stamp, advice, rainNext4h);
          
          // Use <details> to keep logs clean
          md += `\n  <details><summary>🌦️ Weather & Oracle Advice</summary>\n\n${stampMd.replace(/^/gm, '    ')}\n  </details>\n`;
        }
      }

      }
      
      if (log.next_action) {
        const next = log.next_action;
        const statusIcon = next.status === 'completed' ? '✅' : '⏳';
        md += `  - *Next Action*: ${statusIcon} ${next.action} (Due: ${next.reminder_date ? next.reminder_date.substring(0, 10) : 'N/A'})\n`;
      }
      md += `\n`;
    });
  }

  return md;
}

function getActivityIcon(type: string): string {
  switch (type) {
    case 'watering': return '💧';
    case 'spraying': return '🚿';
    case 'fertilizing': return '🌱';
    case 'pruning': return '✂️';
    case 'monitoring': return '👀';
    default: return '📝';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDetails(details: Record<string, any>): string {
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
