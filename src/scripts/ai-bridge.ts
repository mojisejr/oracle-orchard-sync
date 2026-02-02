/**
 * 🌉 AI BRIDGE: The Visual Intelligence
 * Connects Real World Data (Supabase) -> Heuristic Logic -> Visual Manifest
 * 
 * Usage:
 * bun src/scripts/ai-bridge.ts --plot=suan_ban
 */

import minimist from 'minimist';
import { loadSystemContext } from '../lib/context-loader';
import { generateManifest } from '../lib/manifest-generator';
import { SITREP } from '../types/orchard-core';

// --- REFLEX LOGIC (Phase 4) ---

function applyHeuristics(sitrep: SITREP) {
    const current = sitrep.environment.current;
    const forecast = sitrep.environment.forecast;
    
    // 1. Water Stress Check (VPD)
    if (current.vpd > 2.0) {
        sitrep.insight!.status = 'watch';
        sitrep.insight!.headlines.push('High Water Stress (VPD > 2.0)');
    }

    // 2. Flood Risk Check (Rain)
    const heavyRain = forecast.some(f => (f.rainMm || 0) > 30);
    if (heavyRain) {
        sitrep.insight!.status = 'critical'; // Emergency
        sitrep.insight!.headlines.push('Heavy Rain Alert (>30mm forecasted)');
    }

    // 3. Drought Check (Soil Moisture - Simulated based on Rain/VPD for now as we don't have moisture sensor in DB yet)
    // If no rain for 5 days and High VPD
    const drySpell = forecast.slice(0, 5).every(f => (f.rainMm || 0) < 1);
    if (drySpell && current.vpd > 1.5) {
        sitrep.insight!.status = 'watch';
        sitrep.insight!.headlines.push('Drought Conditions Developing');
    }
}

// --- STD-IN READER (Phase 5) ---

async function readStdin(): Promise<string> {
    const { stdin } = process;
    if (stdin.isTTY) return '';

    return new Promise((resolve, reject) => {
        let data = '';
        stdin.on('data', chunk => { data += chunk; });
        stdin.on('end', () => resolve(data));
        stdin.on('error', reject);
    });
}

// --- MAIN ---

async function main() {
    const args = minimist(process.argv.slice(2), {
        string: ['plot'],
        boolean: ['manual'], // Enable manual overrides
        default: {
            days: 3,
            plot: 'all',
            manual: false
        }
    });

    const requestedPlots = args.plot === 'all' 
        ? [] 
        : args.plot.split(',').map((p: string) => p.trim());

    // 1. Load Context (Sensory)
    const context = await loadSystemContext({
        horizonDays: parseInt(String(args.days)),
        requestedPlots: requestedPlots
    });

    // 2. Apply Logic (Brain)
    
    // 2.a Heuristics (Reflexes)
    Object.values(context.plots).forEach(sitrep => {
        applyHeuristics(sitrep);
    });

    // 2.b Manual Override (Oracle Interface Phase 5)
    // Checks if STDIN has JSON payload to override insights
    if (args.manual) {
        const input = await readStdin();
        if (input) {
            try {
                const override = JSON.parse(input);
                // Expecting { status: '...', headlines: [...] }
                // Apply to ALL plots in context for now (Global Broadcast)
                Object.values(context.plots).forEach(sitrep => {
                     if (override.status) sitrep.insight!.status = override.status;
                     if (override.headlines) sitrep.insight!.headlines = override.headlines;
                     // Optional: Inject custom content if needed later
                });
            } catch (e) {
                console.warn('⚠️ Failed to parse Manual Input:', e);
            }
        }
    }

    // 3. Generate Manifest (Visual)
    // If single plot is filtered, we pass it to generateManifest to optimize focus
    const filterPlot = requestedPlots.length === 1 ? requestedPlots[0] : undefined;
    const manifest = generateManifest(context, filterPlot);

    // 4. Output
    console.log(JSON.stringify(manifest, null, 2));
}

main().catch(err => {
    console.error('Fatal Error in AI Bridge:', err);
    process.exit(1);
});
