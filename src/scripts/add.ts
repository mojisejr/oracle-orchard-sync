import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { supabase } from '../lib/supabase';
import { ActivityType } from '../types/legacy';
import { WeatherService } from '../lib/weather';
import { fetchPlotProfile, resolvePlotId } from '../lib/plot-service';

async function main() {
  const { values } = parseArgs({
    options: {
      type: {
        type: 'string',
        short: 't',
      },
      plot: {
        type: 'string',
        short: 'p',
      },
      notes: {
        type: 'string',
        short: 'n',
      },
      date: {
        type: 'string',
        short: 'd',
      },
      'next-action': {
        type: 'string',
      },
      'next-days': {
        type: 'string',
        default: '7',
      },
    },
  });

  if (!values.type || !values.plot) {
    console.error('❌ Error: Missing required arguments: --type and --plot');
    console.error('Usage: npm run add -- --type <type> --plot <name> [--notes <notes>]');
    process.exit(1);
  }

  // Validate Type
  const validTypes: ActivityType[] = ['watering', 'spraying', 'monitoring', 'fertilizing', 'pruning', 'other'];
  if (!validTypes.includes(values.type as ActivityType)) {
    console.error(`❌ Error: Invalid activity type. Valid types: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  const activityType = values.type as ActivityType;
  // Phase 2: Code Intelligence - Auto Map to Standard ID
  const rawPlotName = values.plot;
  const resolvedPlotId = resolvePlotId(rawPlotName);
  
  // Phase 4: Hard Gate - Strict Validation
  if (!resolvedPlotId) {
    console.error(`❌ Error: Unknown plot name "${rawPlotName}".`);
    console.error(`Valid options: suan_ban, suan_makham, suan_lang, plant_shop (or keys: บ้าน, มะขาม, ล่าง, พันธุ์ไม้)`);
    process.exit(1);
  }

  const plotName = resolvedPlotId;
  
  if (plotName !== rawPlotName) {
    console.log(`ℹ️  Identity Standardization: Mapped "${rawPlotName}" -> "${plotName}"`);
  }

  const notes = values.notes || '';
  
  // Prepare Insert Data
  const insertData: any = {
    activity_type: activityType,
    plot_name: plotName,
    details: {}, 
    notes: notes,
  };

  if (values.date) {
    insertData.created_at = new Date(values.date).toISOString();
  }

  // Handle Next Action
  if (values['next-action']) {
    const days = parseInt(values['next-days'] || '7', 10);
    const referenceDate = values.date ? new Date(values.date) : new Date();
    const reminderDate = new Date(referenceDate);
    reminderDate.setDate(reminderDate.getDate() + days);

    insertData.next_action = {
      action: values['next-action'],
      days: days,
      reminder_date: reminderDate.toISOString().split('T')[0], // YYYY-MM-DD
      status: 'pending'
    };
  }

  // Insert to DB
  console.log('🚀 Inserting activity log...');
  
  const { data, error } = await supabase
    .from('activity_logs')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('❌ Insert failed:', error.message);
    process.exit(1);
  }

  console.log(`✅ Success! Log ID: ${data.id}`);
  // Output JSON for AI Parsing
  console.log(JSON.stringify(data));

  // --- AUTOMATION HOOK: SYNC ON WRITE ---
  try {
    const syncDate = values.date || new Date().toLocaleDateString('en-CA');
    console.log(`\n🔄 Auto-syncing logs for ${syncDate} (${plotName})...`);
    execSync(`npm run sync -- --date ${syncDate} --plot ${plotName}`, { stdio: 'inherit' });
  } catch (e) {
    console.warn('⚠️ Auto-sync failed, but log was saved to DB.');
  }

  // --- PHASE 1: CONTEXTUAL EVIDENCE ---
  try {
    const weatherService = new WeatherService();
    // Resolve Context (Promise)
    const profile = await fetchPlotProfile(plotName);
    
    if (profile) {
        const stamps = await weatherService.getHourlyForecast(profile.lat, profile.lon);
        if (stamps.length > 0) {
        const current = weatherService.findClosestStamp(stamps, new Date())?.stamp || stamps[0];
        const startIndex = stamps.indexOf(current);
        const advices = weatherService.generateAdvice(stamps, startIndex);
        
        const criticalAdvice = advices
            .filter(a => a.status !== 'safe')
            .map(a => `[${a.status.toUpperCase()}] ${a.message}`)
            .join(' | ');

        console.log(`\n📊 Oracle Context: ${profile.name_th}`);
        console.table([{
            Temp: `${current.temp_c}°C`,
            Humidity: `${current.humidity_percent}%`,
            OracleOpinion: criticalAdvice || '✅ Safe'
        }]);
        }
    }
  } catch (e) {
    // Ignore weather errors during add
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
