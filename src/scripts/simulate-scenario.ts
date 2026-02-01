/**
 * 🎭 SIMULATOR: Phase 5 Verification
 * 
 * Generates synthetic SITREPs to test the Brain's response to extreme conditions.
 * Used for "What If" scenarios and Hard Gate verification.
 */

import { SITREP, DailyMetData, OrchardPlot } from '../types/orchard-core';
import { generateManifest } from '../lib/manifest-generator';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2));

// --- MOCK DATA FACTORY ---

function createMockPlot(id: string, asset: any, soil: any, sensitiveToFlood: number = 0): OrchardPlot {
    return {
        id,
        profile: {
            name_th: id,
            // @ts-ignore
            crop: 'mixed',
            // @ts-ignore
            area_rai: 1,
            lat: 0,
            lon: 0,
            soil: soil,
            stage: 'preparing_leaf', // Fixed valid stage
            personality: {
                notes: `Mock plot for ${asset}`,
                critical_asset: asset,
                sensitivity_flood: sensitiveToFlood,
                sensitivity_drought: 5
            },
            // @ts-ignore
            water: 'normal'
        }
    };
}

function createForecast(days: number, condition: 'nominal' | 'flood' | 'drought' | 'heat'): DailyMetData[] {
    return Array.from({ length: days }).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        let met: Partial<DailyMetData> = {
            date: date.toISOString().split('T')[0],
            tempMax: 32,
            tempMin: 24,
            rainProb: 20,
            rainMm: 0,
            vpd: 1.0,
            eto: 4.0,
            gdd: 15
        };

        if (condition === 'flood') {
            met.rainMm = 80 + (Math.random() * 50); // > 50mm trigger
            met.rainProb = 90;
            met.vpd = 0.2;
        } else if (condition === 'drought') {
            met.rainMm = 0;
            met.vpd = 2.5 + (Math.random() * 0.5); // > 2.0 trigger
            met.tempMax = 36;
        } else if (condition === 'heat') {
            met.tempMax = 38 + (Math.random() * 2);
            met.vpd = 2.8;
        }

        return met as DailyMetData;
    });
}

// --- MAIN SIMULATION ---

function runSimulation() {
    const scenario = args.scenario || 'nominal'; // flood, drought
    console.warn(`🧪 Running Simulation Scenario: ${scenario.toUpperCase()}`);

    // Create 3 Standard Mock Plots
    const plots: Record<string, SITREP> = {
        'suan_lang': {
            timestamp: new Date().toISOString(),
            plot: createMockPlot('suan_lang', 'durian', 'clayey_filled', 9), // High flood sensitivity
            environment: {
                history: [],
                current: createForecast(1, scenario)[0],
                forecast: createForecast(3, scenario)
            },
            activities: { recent: [] }
        },
        'suan_makham': {
            timestamp: new Date().toISOString(),
            plot: createMockPlot('suan_makham', 'durian', 'loam', 5),
            environment: {
                history: [],
                current: createForecast(1, scenario)[0],
                forecast: createForecast(3, scenario)
            },
            activities: { recent: [] }
        },
        'plant_shop': {
            timestamp: new Date().toISOString(),
            plot: createMockPlot('plant_shop', 'seedling', 'potting_mix', 2),
            environment: {
                history: [],
                current: createForecast(1, scenario)[0],
                forecast: createForecast(3, scenario)
            },
            activities: { recent: [] }
        }
    };

    // Generate Manifest (The Brain)
    const manifest = generateManifest({
        timestamp: new Date().toISOString(),
        plots
    });
    
    // Override Title for clarity
    manifest.summary = `[SIMULATION] ${manifest.summary}`;

    // Output JSON
    console.log(JSON.stringify(manifest, null, 2));
}

runSimulation();
