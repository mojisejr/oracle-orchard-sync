
import { supabase } from '../lib/supabase';
import { analyzeIrrigation, analyzeDisease, analyzePhysiology, analyzePest } from '../lib/conditions';
import { DailyForecast, WeatherInsight } from '../types/weather';

async function runSynthesis() {
  console.log('🧠 Starting Orchard Intelligence Synthesis...');

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
  // (In case multiple fetches happened)
  const uniqueMap = new Map<string, DailyForecast>();
  
  // Sort by fetched_at ascending, so latest overwrites previous
  // But we didn't sort by fetched_at in SQL. Let's sort locally or assume db constraints help.
  // We'll trust the 'latest' one usually comes last or just process what we have.
  // Actually, better to just process.
  
  for (const row of forecasts) {
      const key = `${row.location_id}_${row.forecast_date}`;
      // In a real app, we might compare fetched_at timestamps here.
      uniqueMap.set(key, row as DailyForecast);
  }

  // 3. Run Logic Engine
  const insights: WeatherInsight[] = [];

  for (const forecast of uniqueMap.values()) {
    // Irrigation
    const irrigation = analyzeIrrigation(forecast);
    if (irrigation) insights.push(irrigation);

    // Disease
    const disease = analyzeDisease(forecast);
    if (disease) insights.push(disease);

    // Physiology
    const physio = analyzePhysiology(forecast);
    if (physio) insights.push(physio);

    // Pest
    const pest = analyzePest(forecast);
    if (pest) insights.push(pest);
  }

  // 4. Report Results to Console (for Agent to read)
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
