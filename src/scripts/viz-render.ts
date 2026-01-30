import fs from 'fs';
import path from 'path';
import minimist from 'minimist';
import { exec } from 'child_process';

// Args
const args = minimist(process.argv.slice(2));
const VIEW_MODE = args.view || 'strategic';
const OPEN_BROWSER = args.open || false;
// Allow manual focus override, otherwise rely on data
const FOCUS_PLOT = args.focus ? String(args.focus) : undefined;

// Paths
const TEMPLATE_PATH = path.join(__dirname, '../templates/viz/dashboard.ejs');
const OUTPUT_DIR = path.join(__dirname, '../../out');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'dashboard.html');

// --- Types ---

interface ForecastData {
    date: string;
    temp_max: number;
    temp_min: number;
    rh: number;
    vp: number; // calculated vapor pressure if needed
    vpd: number;
    eto: number;
    rain_prob: number;
}

interface PlotData {
    profile: {
        stage: string;
        soil: string;
        personality: string;
    };
    forecasts: ForecastData[];
    pending_tasks: any[];
}

interface SitrepData {
    timestamp: string;
    meta: { focus: string[] };
    plots: Record<string, PlotData>;
}

interface VisualData {
    meta: {
        generatedAt: string;
        viewMode: string;
        version: string;
        focusPlot: string;
    };
    hud: Array<{ label: string; value: string; color: string }>;
    hero: {
        title: string;
        desc: string;
        type: string;
        labels: string[];
        datasets: any[];
    } | null;
}

/**
 * Reads data from stdin
 */
function readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = '';
        const stdin = process.stdin;

        if (stdin.isTTY) {
            console.log('Orchard Sight Renderer: Waiting for JSON input via pipe...');
        }

        stdin.setEncoding('utf8');
        
        stdin.on('data', chunk => {
            data += chunk;
        });

        stdin.on('end', () => {
            resolve(data);
        });

        stdin.on('error', err => {
            reject(err);
        });
    });
}

/**
 * Logic: Transform Raw SITREP to Visual Identity
 */
function transformToVisual(raw: SitrepData, viewMode: string, requestedFocus?: string): VisualData {
    // 1. Determine Target Plot
    const availablePlots = Object.keys(raw.plots || {});
    const targetSlug = requestedFocus && availablePlots.includes(requestedFocus) 
        ? requestedFocus 
        : availablePlots[0]; // Default to first available

    if (!targetSlug) {
        // Fallback for no data
        return {
            meta: { generatedAt: new Date().toISOString(), viewMode: 'error', version: '3.3.0', focusPlot: 'none' },
            hud: [{ label: 'Error', value: 'No Data', color: 'text-red-500' }],
            hero: null
        };
    }

    const plot = raw.plots[targetSlug];
    const texts = raw.timestamp ? raw.timestamp : new Date().toISOString(); 

    // 2. HUD Construction (Today's Snapshot)
    const today = plot.forecasts[0] || { temp_max: 0, rh: 0, vpd: 0, rain_prob: 0, eto: 0 };
    const hud = [
        { 
            label: 'Max Temp', 
            value: `${Math.round(today.temp_max)}°C`, 
            color: today.temp_max > 35 ? 'text-red-400' : 'text-slate-200' 
        },
        { 
            label: 'Min RH', 
            value: `${Math.round(today.rh)}%`, 
            color: today.rh < 50 ? 'text-amber-400' : 'text-emerald-400' 
        },
        { 
            label: 'VPD (kPa)', 
            value: today.vpd.toFixed(2), 
            color: today.vpd > 1.6 ? 'text-red-400' : (today.vpd < 0.8 ? 'text-blue-400' : 'text-emerald-400')
        },
        { 
            label: 'Rain Prob', 
            value: `${Math.round(today.rain_prob)}%`, 
            color: today.rain_prob > 40 ? 'text-blue-400' : 'text-slate-400' 
        }
    ];

    // 3. Hero Logic (Personality Driven)
    // Tamarind -> VPD, Lower -> Rain, Pram -> Temp
    let heroConfig: any = { type: 'line', datasets: [] };
    let heroTitle = 'General Overview';
    let heroDesc = 'Standard monitoring view';

    const labels = plot.forecasts.map(f => f.date.split('T')[0].slice(5)); // MM-DD

    if (targetSlug.includes('tamarind') || targetSlug === 'house') {
        // Crown Jewel logic: Watch VPD closely
        heroTitle = 'VPD & Moisture Stress';
        heroDesc = `${plot.profile.personality} (Monitoring Drought Risk)`;
        heroConfig = {
            type: 'line',
            labels: labels,
            datasets: [{
                label: 'VPD (kPa)',
                data: plot.forecasts.map(f => f.vpd),
                borderColor: '#10b981', // Emerald
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }]
        };
    } else if (targetSlug.includes('lower')) {
        // Fortress Logic: Watch Rain/Flood
        heroTitle = 'Precipitation & Flood Risk';
        heroDesc = 'Low-lying area monitoring (Flood Prone)';
        heroConfig = {
            type: 'bar', // Bar for rain
            labels: labels,
            datasets: [{
                label: 'Rain Probability (%)',
                data: plot.forecasts.map(f => f.rain_prob),
                borderColor: '#3b82f6', // Blue
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderWidth: 1
            }, {
                type: 'line',
                label: 'ETo (mm)', // Evapotranspiration as context
                data: plot.forecasts.map(f => f.eto),
                borderColor: '#f59e0b', // Amber
                borderDash: [5, 5]
            }]
        };
    } else if (targetSlug.includes('pram')) {
        // Nursery Logic: Watch Heat
        heroTitle = 'Heat Stress & Solar Load';
        heroDesc = 'Seedling sensitivity tracking';
        heroConfig = {
            type: 'line',
            labels: labels,
            datasets: [{
                label: 'Max Temp (°C)',
                data: plot.forecasts.map(f => f.temp_max),
                borderColor: '#ef4444', // Red
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true
            }]
        };
    } else {
        // Default Logic (Smart Fallback) based on data anomalies
        const maxVpd = Math.max(...plot.forecasts.map(f => f.vpd));
        if (maxVpd > 1.6) {
             heroTitle = 'Critical: Dry Air Warning';
             heroDesc = 'High VPD detected. Irrigation priority.';
             heroConfig = {
                type: 'line',
                labels: labels,
                datasets: [{
                    label: 'VPD (kPa)',
                    data: plot.forecasts.map(f => f.vpd),
                    borderColor: '#ef4444', 
                    fill: true
                }]
            };
        } else {
            heroTitle = 'Orchard Vital Signs';
            heroDesc = 'Routine monitoring';
            heroConfig = {
                type: 'line',
                labels: labels,
                datasets: [{
                    label: 'VPD (kPa)',
                    data: plot.forecasts.map(f => f.vpd),
                    borderColor: '#10b981'
                }, {
                    label: 'Temp Max (°C)',
                    data: plot.forecasts.map(f => f.temp_max),
                    borderColor: '#f59e0b',
                    hidden: true // hide by default
                }]
            };
        }
    }

    // Attach weather metadata to dataset for tooltip usage in EJS
    heroConfig.datasets[0].weatherData = plot.forecasts.map(f => ({
        temp: f.temp_max,
        rh: f.rh
    }));

    return {
        meta: {
            generatedAt: new Date().toISOString(),
            viewMode: viewMode,
            version: '3.3.0',
            focusPlot: targetSlug
        },
        hud: hud,
        hero: {
            title: heroTitle,
            desc: heroDesc,
            type: heroConfig.type,
            labels: heroConfig.labels,
            datasets: heroConfig.datasets
        }
    };
}

/**
 * Main Renderer Logic
 */
async function main() {
    try {
        // 1. Ensure output directory exists
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        // 2. Read Input Data
        const rawInputString = await readStdin();
        let rawInput: any;
        
        try {
            // Fix: Extract JSON from potential log noise
            const firstBrace = rawInputString.indexOf('{');
            const lastBrace = rawInputString.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1) {
                const cleanJson = rawInputString.substring(firstBrace, lastBrace + 1);
                rawInput = JSON.parse(cleanJson);
            } else {
                throw new Error('No JSON brackets found');
            }
        } catch (e) {
            console.warn('⚠️  No valid JSON input received (Parsing failed). Raw input length: ' + rawInputString.length);
            // Fallback for empty/error input
            rawInput = { plots: {} };
        }

        // 3. Transform Data (The Intelligence Layer)
        const visualData = transformToVisual(rawInput, VIEW_MODE, FOCUS_PLOT);

        // 4. Read Template
        if (!fs.existsSync(TEMPLATE_PATH)) {
            throw new Error(`Template not found at: ${TEMPLATE_PATH}`);
        }
        let templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

        // 5. Injection Strategy (Regex Replacement)
        const injectionTarget = /const INJECTED_DATA = \{[\s\S]*?\};/;
        
        // Populate specific HTML IDs for text
        // (This is a simple server-side render approach using string replacement for the big data, 
        //  but we can also replace text placeholders if we wanted. 
        //  For now, the client side JS in dashboard.ejs handles rendering based on INJECTED_DATA)
        
        const injectedPayload = `const INJECTED_DATA = ${JSON.stringify(visualData, null, 4)};`;
        
        if (!injectionTarget.test(templateContent)) {
            throw new Error('Injection point "const INJECTED_DATA = { ... };" not found in template.');
        }
        
        // Inject Title and Desc directly into HTML for SEO/Fallbacks (Optional, but good for "Pre-rendering")
        let renderedHtml = templateContent.replace(injectionTarget, injectedPayload);
        
        // Quick replace for Hero Title/Desc if we want to be fancy (Server Side Rendering simple fields)
        if (visualData.hero) {
             renderedHtml = renderedHtml
                .replace('<span id="hero-title">Primary Intelligence</span>', `<span id="hero-title">${visualData.hero.title}</span>`)
                .replace('<p id="hero-desc" class="text-slate-400 text-sm">Most critical data based on current context.</p>', `<p id="hero-desc" class="text-slate-400 text-sm">${visualData.hero.desc}</p>`);
        }

        // 6. Write Output
        fs.writeFileSync(OUTPUT_FILE, renderedHtml);
        console.log(`✅ Dashboard rendered to: ${OUTPUT_FILE}`);

        // 7. Auto-Open
        if (OPEN_BROWSER) {
            const command = process.platform === 'darwin' ? 'open' : 
                          process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${command} ${OUTPUT_FILE}`);
        }

    } catch (err) {
        console.error('❌ Render Failed:', err);
        process.exit(1);
    }
}

main();
