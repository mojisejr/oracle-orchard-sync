import minimist from 'minimist';
import { ProfileManager } from '../lib/profile-manager';
import { supabase } from '../lib/supabase';
import { GrowthStage, SoilType, WaterSourceQuality, PlotPersonality } from '../lib/plot-mapper';

// Force load .env via Supabase client (which does it internally) but we might need it for local run
// Actually ProfileManager handles the loading via supabase.ts

const args = minimist(process.argv.slice(2));

async function main() {
    const cmd = args._[0];
    const slug = args._[1];

    if (!cmd) {
        printUsage();
        process.exit(1);
    }

    try {
        switch (cmd) {
            case 'set':
                await setProfile(slug, args);
                break;
            case 'sync':
                await syncProfiles();
                break;
            case 'list':
                await listProfiles();
                break;
            default:
                console.error(`❌ Unknown command: ${cmd}`);
                printUsage();
                process.exit(1);
        }
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function listProfiles() {
    console.log('📡 Fetching profiles...');
    const manager = ProfileManager.getInstance();
    const profiles = await manager.getAllProfiles(true);
    
    console.table(Object.entries(profiles).map(([slug, p]) => ({
        slug,
        stage: p.stage,
        soil: p.soil,
        drought: p.personality.sensitivity_drought,
        flood: p.personality.sensitivity_flood,
        asset: p.personality.critical_asset
    })));
}

async function syncProfiles() {
    console.log('⚠️  Syncing LOCAL Fallback Profiles to DB...');
    // We instantiate ProfileManager to get access to FALLBACK (which is private/internal logic)
    // Wait, ProfileManager fallback logic is internal.
    // So we should manually trigger the fallback return by force failing or just manually constructing it?
    // Actually, ProfileManager currently returns fallback if DB is empty.
    
    // Better strategy: We can't easily export FALLBACK from ProfileManager without refactoring.
    // But since this is a one-time migration tool, let's just grab the current output of ProfileManager
    // (which we know mimics valid data) and push it UP if the row doesn't exist.
    
    const manager = ProfileManager.getInstance();
    const profiles = await manager.getAllProfiles(true); // Fetches what it sees (fallback or db)

    for (const [slug, profile] of Object.entries(profiles)) {
        console.log(`📤 Syncing: ${slug}...`);
        
        // Upsert
        const payload = {
            slug,
            name_th: profile.name_th,
            lat: profile.lat,
            lon: profile.lon,
            stage: profile.stage,
            soil_type: profile.soil,
            water_source: profile.water,
            sensitivity_drought: profile.personality.sensitivity_drought,
            sensitivity_flood: profile.personality.sensitivity_flood,
            critical_asset: profile.personality.critical_asset,
            notes: profile.personality.notes,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('plot_profiles')
            .upsert(payload, { onConflict: 'slug' });
            
        if (error) {
            console.error(`❌ Failed to sync ${slug}:`, error.message);
        } else {
            console.log(`✅ Synced ${slug}`);
        }
    }
    console.log('✅ Sync Complete.');
}

async function setProfile(slug: string, opts: any) {
    if (!slug) {
        console.error('❌ Missing slug');
        return;
    }

    console.log(`🔧 Updating ${slug}...`);

    // Build update object dynamically
    const updatePayload: any = {
        updated_at: new Date().toISOString()
    };

    if (opts.stage) updatePayload.stage = opts.stage;
    if (opts.soil) updatePayload.soil_type = opts.soil;
    if (opts.drought) updatePayload.sensitivity_drought = opts.drought;
    if (opts.flood) updatePayload.sensitivity_flood = opts.flood;
    if (opts.notes) updatePayload.notes = opts.notes;

    if (Object.keys(updatePayload).length <= 1) {
        console.warn('⚠️  No fields to update. Use --stage, --soil, --drought, etc.');
        return;
    }

    const { error } = await supabase
        .from('plot_profiles')
        .update(updatePayload)
        .eq('slug', slug);

    if (error) {
        throw error;
    }

    console.log(`✅ Update successful for ${slug}`);
}

function printUsage() {
    console.log(`
Usage:
  npm run plot:list
  npm run plot:sync                  (Push local constants to DB)
  npm run plot:set <slug> [flags]    (Update specific fields)

Flags:
  --stage <string>
  --soil <string>
  --drought <number>
  --flood <number>
  --notes <string>
    `);
}

main().catch(console.error);
