
import { supabase } from '../lib/supabase';

async function checkConsistency() {
    console.log('--- 🔍 Orchard Consistency Check: Activity Logs ---');
    
    // Get unique plot names
    const { data: plotNames, error: plotError } = await supabase
        .from('activity_logs')
        .select('plot_name');

    if (plotError) {
        console.error('❌ Error fetching plot names:', plotError);
        return;
    }

    if (!plotNames || plotNames.length === 0) {
        console.log('No activity logs found.');
        return;
    }

    const uniquePlots = Array.from(new Set(plotNames.map(p => p.plot_name)));
    console.log(`Found ${uniquePlots.length} unique plot names in database:`);
    console.log(JSON.stringify(uniquePlots, null, 2));

    // Also check total counts for each
    const counts: Record<string, number> = {};
    plotNames.forEach(p => {
        counts[p.plot_name] = (counts[p.plot_name] || 0) + 1;
    });

    console.log('\n📊 Distribution:');
    console.table(counts);

    // Get count of historical logs (last 5) to see format
    const { data: recentLogs, error: recentError } = await supabase
        .from('activity_logs')
        .select('plot_name, activity_type, created_at, notes')
        .order('created_at', { ascending: false })
        .limit(10);

    if (recentError) {
        console.error('❌ Error fetching recent logs:', recentError);
    } else {
        console.log('\n📅 Recent logs sample:');
        console.table(recentLogs);
    }
}

checkConsistency();
