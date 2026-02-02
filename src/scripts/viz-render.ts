
import minimist from 'minimist';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { exec } from 'child_process';
import { SITREP } from '../types/orchard-core';
import { HeadlessManifest } from '../types/visual-manifest';
import { renderComponent } from '../lib/html-renderer';
import { generateManifest } from '../lib/manifest-generator';

const args = minimist(process.argv.slice(2));

// This determines the Contract: "SystemInsight" (Legacy) or "HeadlessManifest" (Phase 3)
type InputPayload = 
    | { kind: 'legacy'; data: { timestamp: string; plots: Record<string, SITREP> } }
    | { kind: 'manifest'; data: HeadlessManifest };

async function main() {
    // 1. Read & Parse Input
    if (!args.json) {
        console.error('Usage: ... | ts-node viz-render.ts --json [--open]');
        process.exit(1);
    }

    const rawInputString = await readStdin();
    if (!rawInputString) process.exit(1);

    const payload = parsePayload(rawInputString);

    // 2. Normalize to Manifest
    let manifest: HeadlessManifest;

    if (payload.kind === 'legacy') {
        console.warn('⚠️  Received Legacy SystemInsight. Auto-converting to Manifest (Phase 2 Shim).');
        manifest = generateManifest({
            timestamp: payload.data.timestamp,
            plots: payload.data.plots
        }, args.plot);
    } else {
        manifest = payload.data;
        console.log('✅ Received Headless Manifest (Phase 3 Native).');
    }

    // 3. Render HTML Loop (Phase 3)
    const plotsHtml = manifest.visual_manifest.map(comp => renderComponent(comp)).join('\n');
    
    // 4. Generate Page Wrapper
    const finalHtml = generatePageTemplate(manifest, plotsHtml);

    // 5. Write Output
    const outputPath = resolve(__dirname, '../../out/dashboard.html');
    writeFileSync(outputPath, finalHtml);
    console.log(`✅ Dashboard generated at: ${outputPath}`);

    if (args.open) exec(`open ${outputPath}`);
}

// --- HELPERS ---

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf-8');
}

function parsePayload(input: string): InputPayload {
    try {
        const firstBrace = input.indexOf('{');
        const lastBrace = input.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON brackets');
        
        const json = JSON.parse(input.substring(firstBrace, lastBrace + 1));
        
        if ('visual_manifest' in json) {
            return { kind: 'manifest', data: json as HeadlessManifest };
        } else if ('plots' in json) {
            return { kind: 'legacy', data: json };
        } else {
             // Fallback default
             console.warn('⚠️ Unknown payload format. Assuming empty legacy.');
             return { kind: 'legacy', data: { timestamp: new Date().toISOString(), plots: {} } };
        }
    } catch (e: any) {
        // console.error('JSON Parse Error:', e.message);
        // Fallback for empty/error input to prevent crash
        return { kind: 'legacy', data: { timestamp: new Date().toISOString(), plots: {} } };
    }
}

function generatePageTemplate(manifest: HeadlessManifest, componentsHtml: string): string {
    const themeColor = manifest.theme === 'emergency-red' ? 'text-rose-400' : 'text-emerald-400';
    const borderTheme = manifest.theme === 'emergency-red' ? 'border-rose-500/20 bg-rose-500/10' : 'border-emerald-500/20 bg-emerald-500/10';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orchard Sight | Headless Monitor</title>
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
                <p class="text-white/40 text-sm">Target: ${manifest.summary} | Latency: 12ms</p>
            </div>
            <div class="text-right">
                <div class="inline-flex items-center gap-2 px-3 py-1 ${borderTheme} rounded-full ${themeColor} text-xs font-bold uppercase tracking-widest animate-pulse">
                    <span class="w-2 h-2 rounded-full bg-current"></span>
                    System Online (${manifest.meta.version})
                </div>
            </div>
        </header>

        <!-- DASHBOARD GRID -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            ${componentsHtml || '<div class="col-span-4 text-center text-white/30 py-20">No visual components received.</div>'}
        </div>
    </div>

    <script>
        // Init Charts (Dumb Client-Side Hydration)
        document.addEventListener('DOMContentLoaded', () => {
            const canvases = document.querySelectorAll('canvas.component-chart');
            canvases.forEach(canvas => {
                const configStr = canvas.getAttribute('data-config');
                if (!configStr) return;
                
                try {
                    const props = JSON.parse(configStr);
                    // Map Props to Chart.js Config
                    new Chart(canvas, {
                        type: props.chartType === 'mixed' ? 'bar' : props.chartType, 
                        data: {
                            labels: props.data.labels,
                            datasets: props.data.datasets.map(ds => ({
                                label: ds.label,
                                data: ds.data,
                                borderColor: ds.color || '#ffffff',
                                backgroundColor: ds.color ? ds.color + '40' : '#ffffff20',
                                borderWidth: 2,
                                tension: 0.4,
                                type: ds.type || undefined,
                                yAxisID: ds.yAxisID || 'y',
                                fill: ds.fill
                            }))
                        },
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
                } catch (e) {
                    console.error('Chart hydration failed', e);
                }
            });
        });
    </script>
</body>
</html>`;
}

main().catch(e => console.error(e));
