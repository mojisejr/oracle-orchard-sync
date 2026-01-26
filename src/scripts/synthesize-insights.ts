
import { supabase } from '../lib/supabase';
import { analyzeIrrigation, analyzeDisease, analyzePhysiology, analyzePest } from '../lib/conditions';
import { resolvePlotProfile } from '../lib/plot-mapper';
import { DailyForecast, WeatherInsight } from '../types/weather';

async function runSynthesis() {
  console.log('🧠 Starting Orchard Intelligence Synthesis (Physical Truth Aware)...');

  // 1. Fetch Forecasts for next 7 days
  const today = new Date().toISOString().split('T')[0];
  
  const { data: forecasts, error } = await supabase
    .from('weather_forecasts')
    .select('*')
    .gte('forecast_date', today)
    .order('forecast_date', { ascending: true })
    .limit(50);

  if (error) {
    console.error('❌ Error fetching forecasts:', error);
    return;
  }

  if (!forecasts || forecasts.length === 0) {
    console.warn('⚠️ No forecasts found in Supabase for upcoming days.');
    return;
  }

  console.log(`📊 Processing ${forecasts.length} forecast records from ${today} onwards...`);
  
  // 2. De-dupe: Keep only the latest fetched data for each Location + Date
  const uniqueMap = new Map<string, DailyForecast>();
  
  for (const row of forecasts) {
      const key = `${row.location_id}_${row.forecast_date}`;
      uniqueMap.set(key, row as DailyForecast);
  }

  // 3. Run Logic Engine
  const insights: WeatherInsight[] = [];

  for (const forecast of uniqueMap.values()) {
    // RESOLVE PHYSICAL TRUTH
    // We get the plot context (Stage, Soil, Water) based on the location slug
    // e.g. 'tm1' -> { stage: 'bloom', soil: 'sandy', ... }
    const context = resolvePlotProfile(forecast.location_id);

    // Irrigation (Needs Soil & Bloom context)
    const irrigation = analyzeIrrigation(forecast, context);
    if (irrigation) insights.push(irrigation);

    // Disease (Needs Humidity context, maybe generic)
    // Note: analyzeDisease signature updated to accept context (for Pest logic fallback or future extensions)
    const disease = analyzeDisease(forecast, context);
    if (disease) insights.push(disease);

    // Physiology (Needs Bloom context to prevent induction/burning)
    const physio = analyzePhysiology(forecast, context);
    if (physio) insights.push(physio);

    // Pest (Needs Bloom context for Thrips)
    const pest = analyzePest(forecast, context);
    if (pest) insights.push(pest);
  }

  // 4. Report Results to Console
  console.log('\n=============================================');
  console.log('🦁 ORCHARD SAGE INSIGHTS REPORT');
  console.log('=============================================');
  
  if (insights.length === 0) {
    console.log('✨ All conditions look normal. Keep monitoring.');
  } else {
    // Group by Date for better readability
    const groupedByDate: Record<string, WeatherInsight[]> = {};
    insights.forEach(i => {
        if (!groupedByDate[i.target_date]) groupedByDate[i.target_date] = [];
        groupedByDate[i.target_date].push(i);
    });

    Object.keys(groupedByDate).sort().forEach(date => {
        console.log(`\n📅 Date: ${date}`);
        const dayInsights = groupedByDate[date];
        dayInsights.forEach(insight => {
            const icon = insight.status_level === 'critical' ? '🚨' : insight.status_level === 'warning' ? '⚠️' : 'ℹ️';
            console.log(`   ${icon} [${insight.location_id}] ${insight.category.toUpperCase()}: ${insight.message}`);
        });
    });
  }
}

// Execute
runSynthesis().catch(err => console.error(err));
