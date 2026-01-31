
import minimist from 'minimist';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { exec } from 'child_process';
import { SITREP, DailyMetData } from '../types/orchard-core';

// Wrapper for the System Insight (matches synthesize-insights.ts output)
interface SystemInsight {
    timestamp: string;
    plots: Record<string, SITREP>;
}

// --- INTERFACES For Charting ---
interface ChartDataset {
    label: string;
    data: (number | null)[]; // Allow null for safety
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
    tension?: number;
    type?: string;
    borderWidth?: number;
    borderDash?: number[];
}

interface ChartConfig {
    type: string;
    data: {
        labels: string[];
        datasets: ChartDataset[];
    };
}

// --- MAIN ---

const args = minimist(process.argv.slice(2));

async function main() {
    let inputData: SystemInsight | null = null;

    // 1. Read Input (STDIN or File)
    if (args.json) {
        // Read from STDIN
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
            chunks.push(Buffer.from(chunk));
        }
        const rawInputString = Buffer.concat(chunks).toString('utf-8');
        
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
        } catch (e: any) {
            console.warn('⚠️  No valid JSON input received (Parsing failed). Raw input length ' + rawInputString.length);
            console.warn('Error details:', e.message);
            // Fallback for empty/error input
            rawInput = { plots: {} };
        }
        inputData = rawInput as SystemInsight;
    } else {
        console.error('Usage: ... | ts-node viz-render.ts --json [--open]');
        process.exit(1);
    }

    if (!inputData) process.exit(1);

    // 2. Process Data for Charts
    const plotsHtml = [];

    // Safe iteration over plots
    const plotEntries = inputData.plots ? Object.entries(inputData.plots) : [];

    for (const [slug, sitrep] of plotEntries) {
        const plotProfile = sitrep.plot.profile;
        const forecasts = sitrep.environment.forecast;
        
        // Prepare Forecast Chart Data
        const labels = forecasts.map(f => f.date.split('T')[0].slice(5)); // MD

        let heroTitle = 'General Status';
        let heroDesc = 'Monitoring conditions';
        let heroConfig: ChartConfig = { type: 'line', data: { labels: [], datasets: [] } };

        // --- DYNAMIC CHART LOGIC (THE BRAIN) ---
        // Changed to use Profile Personality instead of Hardcoded Slugs
        
        const personalityNote = (plotProfile.personality.notes || '').toLowerCase();
        const criticalAsset = (plotProfile.personality.critical_asset || '').toLowerCase();
        const stage = (plotProfile.stage || '').toLowerCase();

        let chartData: any = { labels: labels, datasets: [] };
        let chartType = 'line';

        // --- Logic: Explicit View > Smart Context > Default ---
        
        const requestedView = (args.view || '').toLowerCase();
        let mode = 'smart'; // Default to smart auto-detection

        if (requestedView === 'vpd') mode = 'vpd';
        else if (requestedView === 'rain' || requestedView === 'flood') mode = 'rain';
        else if (requestedView === 'temp' || requestedView === 'heat') mode = 'temp';
        else {
            // Smart Detection logic
             if (
                criticalAsset === 'durian' || 
                personalityNote.includes('pollination') || 
                stage === 'bloom' || 
                stage === 'pollination'
            ) {
                mode = 'vpd';
            } else if (plotProfile.personality.sensitivity_flood > 7 || plotProfile.soil.includes('clayey_filled')) {
                mode = 'rain';
            } else if (criticalAsset === 'seedling' || plotProfile.stage === 'seedling') {
                mode = 'temp';
            } else {
                mode = 'default';
            }
        }

        // --- RENDER BASED ON MODE ---

        if (mode === 'vpd') {
            // Durian Logic: Watch VPD & Drought
            heroTitle = 'VPD & Stress Index';
            heroDesc = `Critical Monitoring: ${plotProfile.personality.notes.substring(0, 50)}...`;
            chartData.datasets.push({
                label: 'VPD (kPa)',
                data: forecasts.map(f => f.vpd),
                borderColor: '#10b981', // Emerald
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4
            });
        } else if (mode === 'rain') {
            // Fortress Logic: Watch Rain/Flood
            heroTitle = 'Precipitation & Flood Risk';
            heroDesc = 'Low-lying/Flood Sensitive Area Monitoring';
            chartType = 'bar';
            chartData.datasets.push({
                label: 'Rainfall (mm)',
                data: forecasts.map(f => f.rainMm || 0),
                borderColor: '#3b82f6', // Blue
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderWidth: 1
            }, {
                type: 'line',
                label: 'ETo (mm)',
                data: forecasts.map(f => f.eto),
                borderColor: '#f59e0b',
                borderDash: [5, 5]
            });
        } else if (mode === 'temp') {
            // Nursery Logic: Watch Heat
            heroTitle = 'Heat Stress & Solar Load';
            heroDesc = 'Seedling Sensitivity Tracking';
            chartData.datasets.push({
                label: 'Max Temp (°C)',
                data: forecasts.map(f => f.tempMax),
                borderColor: '#ef4444', // Red
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true
            });
        } else {
            // Default Logic (Overview)
            heroTitle = 'Overview Forecast';
            heroDesc = 'General Weather Monitoring';
            chartData.datasets.push({
                label: 'Max Temp',
                data: forecasts.map(f => f.tempMax),
                borderColor: '#6366f1',
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4
            }, {
                label: 'Rain %',
                type: 'bar',
                data: forecasts.map(f => f.rainProb),
                backgroundColor: 'rgba(59, 130, 246, 0.2)'
            });
        }

        heroConfig = {
            type: chartType,
            data: chartData
        };

        // Render Plot Card HTML
        // Use sitrep.environment.current for the big number if GDD is not main focus? 
        // Or keep GDD as established. Let's keep GDD but format nicely.
        const currentGDD = sitrep.environment.current.gdd || 0; 

        // Null Safety for Activities
        const recentActivities = sitrep.activities?.recent || [];

        const cardHtml = `
        <div class="col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all backdrop-blur-xl">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h2 class="text-2xl font-bold text-white mb-1 uppercase tracking-widest">${slug}</h2>
                    <div class="flex gap-2 text-xs">
                        <span class="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                            ${plotProfile.stage}
                        </span>
                        <span class="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                            ${plotProfile.soil}
                        </span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-3xl font-light text-white">${currentGDD.toFixed(1)}</div>
                    <div class="text-xs text-white/40 uppercase tracking-widest">Daily GDD</div>
                </div>
            </div>

            <!-- DYNAMIC CHART -->
            <div class="chart-container h-48 w-full mb-6">
                <canvas id="chart-${slug}"></canvas>
            </div>

            <!-- CONTEXT & RECENT ACTIVITY -->
            <div class="space-y-4">
                <div>
                    <h4 class="text-xs font-bold text-white/40 uppercase mb-2 tracking-widest">Situation Report</h4>
                    <p class="text-sm text-white/80 leading-relaxed line-clamp-2">${heroDesc}</p>
                </div>

                ${recentActivities.length > 0 ? `
                <div>
                    <h4 class="text-xs font-bold text-white/40 uppercase mb-2 tracking-widest">Recent Ops</h4>
                    <div class="space-y-2">
                        ${recentActivities.slice(0, 2).map((act: any) => `
                        <div class="flex items-center gap-3 text-sm text-white/60">
                            <span class="w-2 h-2 rounded-full bg-white/20"></span>
                            <span class="font-mono text-emerald-400">${new Date(act.date).toLocaleDateString('th-TH', {day:'2-digit', month:'short'})}</span>
                            <span class="truncate">${act.notes}</span>
                        </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            
            <!-- Hidden Data Payload for Chart.js -->
            <script>
                window.chartData = window.chartData || {};
                window.chartData['${slug}'] = ${JSON.stringify(heroConfig)};
            </script>
        </div>
        `;
        plotsHtml.push(cardHtml);
    }

    // 3. Render Final Template
    
    // Default Template (Embedded for robustness)
    const finalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orchard Sight | Bio-Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'JetBrains Mono', monospace; background-color: #050505; }
        .grid-bg { background-image: radial-gradient(#333 1px, transparent 1px); background-size: 20px 20px; opacity: 0.1; }
    </style>
</head>
<body class="text-white min-h-screen relative overflow-x-hidden">
    <div class="fixed inset-0 grid-bg pointer-events-none"></div>
    
    <div class="container mx-auto px-6 py-12 relative z-10">
        <!-- HEADER -->
        <header class="mb-12 flex justify-between items-end border-b border-white/10 pb-6">
            <div>
                <h1 class="text-4xl font-bold mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    ORCHARD SIGHT
                </h1>
                <p class="text-white/40 text-sm">System Time: ${new Date().toLocaleString()}</p>
            </div>
            <div class="text-right">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Live Connection
                </div>
            </div>
        </header>

        <!-- DASHBOARD GRID -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            ${plotsHtml.length > 0 ? plotsHtml.join('\n') : '<div class="col-span-3 text-center text-white/30 py-20">No data received from Cortex.</div>'}
        </div>
    </div>

    <script>
        // Init Charts
        document.addEventListener('DOMContentLoaded', () => {
            Object.keys(window.chartData).forEach(slug => {
                const ctx = document.getElementById('chart-' + slug);
                if (ctx) {
                    new Chart(ctx, {
                        ...window.chartData[slug],
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: true, labels: { color: '#ffffff50', font: { family: 'JetBrains Mono' } } }
                            },
                            scales: {
                                x: { grid: { color: '#ffffff10' }, ticks: { color: '#ffffff50' } },
                                y: { grid: { color: '#ffffff10' }, ticks: { color: '#ffffff50' } }
                            }
                        }
                    });
                }
            });
        });
    </script>
</body>
</html>
    `;

    // 4. Write Output
    const outputPath = resolve(__dirname, '../../out/dashboard.html');
    writeFileSync(outputPath, finalHtml);
    console.log(`✅ Dashboard generated at: ${outputPath}`);

    // Optional: Open
    if (args.open) {
        exec(`open ${outputPath}`);
    }
}

main();
