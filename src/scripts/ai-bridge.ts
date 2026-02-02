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
// [DEPRECATED] Heuristics removed to ensure Dumb Renderer architecture.
// Logic is now upstream (Supabase/AI) or downstream (User Command).

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
        string: ['plot', 'mode'],
        boolean: ['manual'], // Enable manual overrides
        default: {
            days: 3,
            plot: 'all',
            mode: 'default',
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
    
    // 2.a Heuristics (Reflexes) - DEPRECATED
    // Object.values(context.plots).forEach(sitrep => {
    //     applyHeuristics(sitrep);
    // });

    // 2.b Manual Override (Oracle Interface Phase 5 -> Phase 3 Integration)
    // Checks if STDIN has JSON payload to override insights OR inject components
    let injectedComponents: any[] = [];
    let overrideMode: any = null;

    if (args.manual) {
        const input = await readStdin();
        if (input) {
            try {
                const override = JSON.parse(input);
                // Expecting { status: '...', headlines: [...], components: [...], mode: '...' }
                
                // A. Insight Override
                if (override.status || override.headlines) {
                    Object.values(context.plots).forEach(sitrep => {
                        if (override.status) sitrep.insight!.status = override.status;
                        if (override.headlines) sitrep.insight!.headlines = override.headlines;
                    });
                }

                // B. Component Injection
                if (override.components && Array.isArray(override.components)) {
                    injectedComponents = override.components;
                }

                // C. Mode Override
                if (override.mode) {
                    overrideMode = override.mode;
                }

            } catch (e) {
                console.warn('⚠️ Failed to parse Manual Input:', e);
            }
        }
    }

    // 3. Generate Manifest (Visual)
    // If single plot is filtered, we pass it to generateManifest to optimize focus
    // Priority: Override Mode > CLI Arg Mode > Default
    const finalMode = overrideMode || args.mode;
    const filterPlot = requestedPlots.length === 1 ? requestedPlots[0] : undefined;
    
    const manifest = generateManifest(context, filterPlot, finalMode as any, injectedComponents);


    // 4. Output
    console.log(JSON.stringify(manifest, null, 2));
}

main().catch(err => {
    console.error('Fatal Error in AI Bridge:', err);
    process.exit(1);
});
