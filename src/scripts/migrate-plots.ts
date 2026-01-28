
import { supabase } from '../lib/supabase';
import { resolvePlotId } from '../lib/plot-mapper';

async function migrate() {
    console.log('--- 🔄 Orchard Identity Migration: Phase 3 ---');
    console.log('Standardizing plot names to Slug IDs...');

    // 1. Fetch unique plot names from DB
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
    console.log(`Found ${uniquePlots.length} unique plot names needing check:`);
    console.log(uniquePlots);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2. Iterate and Check
    for (const oldName of uniquePlots) {
        const standardId = resolvePlotId(oldName);

        // Case 1: Already standard or Null (Unknown)
        if (!standardId || standardId === oldName) {
            console.log(`✓ "${oldName}" is already standard or unknown. Skipping.`);
            skippedCount++;
            continue;
        }

        // Case 2: Needs Migration
        console.log(`Processing "${oldName}" -> "${standardId}"...`);
        
        const { error: updateError, count } = await supabase
            .from('activity_logs')
            .update({ plot_name: standardId })
            .eq('plot_name', oldName)
            .select(); // In some Supabase versions, select is needed to get count, or use count option

        if (updateError) {
          console.error(`❌ Failed to update "${oldName}":`, updateError.message);
          errorCount++;
        } else {
          console.log(`✅ Migrated logs for "${oldName}" -> "${standardId}"`);
          updatedCount++;
        }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Updated Groups: ${updatedCount}`);
    console.log(`Skipped Groups: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('-------------------------');
}

migrate();
