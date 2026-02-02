/**
 * 🎨 HTML COMPONENT FACTORY
 * Phase 3: The Dumb Renderer Logic
 * 
 * Transforms VisualComponents into HTML strings.
 * Zero business logic allowed here. Only presentation logic.
 */

import { VisualComponent, MetricCard, ChartCard, TableCard, InsightCard, PlotHeaderCard, GaugeCard, ActionGuideCard, PlotCompositeCard, AdviceCard, HeadlessManifest } from '../types/visual-manifest';

// --- MAIN FACTORY ---

export function generatePageTemplate(manifest: HeadlessManifest, componentsHtml: string): string {
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

export function renderComponent(comp: VisualComponent): string {
    switch (comp.type) {
        case 'ADVICE_CARD': return renderAdvice(comp as AdviceCard);
        case 'PLOT_COMPOSITE': return renderPlotComposite(comp as PlotCompositeCard);
        case 'METRIC_CARD': return renderMetric(comp as MetricCard);
        case 'CHART': return renderChartContainer(comp as ChartCard); // Just the container + config script
        case 'TABLE_CARD': return renderTable(comp as TableCard);
        case 'INSIGHT_CARD': return renderInsight(comp as InsightCard);
        case 'PLOT_HEADER': return renderPlotHeader(comp as PlotHeaderCard);
        case 'GAUGE_CARD': return renderGauge(comp as GaugeCard);
        case 'ACTION_GUIDE': return renderActionGuide(comp as ActionGuideCard);
        // @ts-ignore
        default: return `<!-- Unknown Component Type: ${comp.type} -->`;
    }
}

// --- RENDERERS ---

function getColClass(span: number = 1): string {
    // Tailwind Grid Cols
    switch(span) {
        case 2: return 'col-span-2';
        case 3: return 'col-span-3';
        case 4: return 'col-span-4';
        default: return 'col-span-1';
    }
}

function renderPlotComposite(comp: PlotCompositeCard): string {
    const { plotName, stage, tags, primaryMetric, heroChart, recentActivities } = comp.props;
    
    // Inline Chart Config
    const configJson = JSON.stringify(heroChart.config);

    return `
    <div class="${getColClass(comp.colSpan)} bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all backdrop-blur-xl group relative overflow-hidden">
        <!-- HEADER ROW -->
        <div class="flex justify-between items-start mb-6 relative z-10">
            <div>
                <h2 class="text-2xl font-bold text-white mb-1 uppercase tracking-widest leading-none">${plotName}</h2>
                <div class="flex flex-wrap gap-2 mt-2">
                    <span class="px-2 py-0.5 text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 rounded-sm border border-emerald-500/20 tracking-wider">
                        ${stage}
                    </span>
                    ${tags.slice(0, 1).map(t => `<span class="px-2 py-0.5 text-[10px] uppercase font-bold bg-blue-500/10 text-blue-400 rounded-sm border border-blue-500/20 tracking-wider">${t}</span>`).join('')}
                </div>
            </div>
            <div class="text-right">
                <div class="text-3xl font-light text-white leading-none">${primaryMetric.value}</div>
                <div class="text-[10px] text-white/40 uppercase tracking-widest mt-1">${primaryMetric.label}</div>
            </div>
        </div>

        <!-- HERO CHART -->
        <div class="chart-container h-48 w-full mb-6 relative z-10">
            <canvas id="${comp.id}" class="component-chart" data-config='${configJson.replace(/'/g, "&apos;")}'></canvas>
        </div>

        <!-- FOOTER / ACTIVITY -->
        <div class="relative z-10 border-t border-white/5 pt-4">
             <div class="flex justify-between items-center mb-2">
                <h4 class="text-[10px] font-bold text-white/30 uppercase tracking-widest">${heroChart.title}</h4>
             </div>
             ${(recentActivities && recentActivities.length > 0) ? `
             <div class="space-y-2 mt-4">
                ${recentActivities.map(act => `
                    <div class="flex items-start gap-2 text-xs text-white/60">
                        <span class="mt-1.5 w-1 h-1 rounded-full bg-emerald-500/50"></span>
                        <span class="font-mono text-white/30">${new Date(act.date).toLocaleDateString('th-TH', {day:'2-digit', month:'2-digit'})}</span>
                        <span class="truncate">${act.note}</span>
                    </div>
                `).join('')}
             </div>` 
             : `<div class="text-xs text-white/20 italic">No recent activity</div>`}
        </div>

        <!-- DECORATIVE BG -->
        <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
    </div>`;
}

function renderPlotHeader(comp: PlotHeaderCard): string {
    const { plotName, stage, soilType, tags } = comp.props;
    return `
    <div class="${getColClass(comp.colSpan)} flex justify-between items-center p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
        <div>
            <h2 class="text-xl font-bold text-white uppercase tracking-widest">${plotName}</h2>
            <div class="flex gap-2 mt-1">
                <span class="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">${stage}</span>
                <span class="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">${soilType}</span>
            </div>
        </div>
        <div class="flex gap-1">
            ${(tags || []).map(t => `<span class="text-xs text-white/40 uppercase bg-white/5 px-2 py-1 rounded">${t}</span>`).join('')}
        </div>
    </div>`;
}

function renderMetric(comp: MetricCard): string {
    const { label, value, unit, status } = comp.props;
    
    let colorClass = 'text-white';
    if (status === 'warning') colorClass = 'text-amber-400';
    if (status === 'danger') colorClass = 'text-rose-500';

    return `
    <div class="${getColClass(comp.colSpan)} p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
        <div class="text-sm text-white/40 uppercase tracking-widest mb-1">${label}</div>
        <div class="flex items-baseline gap-1">
            <span class="text-3xl font-light ${colorClass}">${value}</span>
            ${unit ? `<span class="text-sm text-white/40">${unit}</span>` : ''}
        </div>
    </div>`;
}

function renderInsight(comp: InsightCard): string {
    const { title, severity, messages } = comp.props;
    
    let bgClass = 'bg-blue-500/10 border-blue-500/20';
    let textClass = 'text-blue-200';
    
    if (severity === 'warning') {
        bgClass = 'bg-amber-500/10 border-amber-500/20';
        textClass = 'text-amber-200';
    } else if (severity === 'critical') {
        bgClass = 'bg-rose-500/10 border-rose-500/20';
        textClass = 'text-rose-200';
    }

    return `
    <div class="${getColClass(comp.colSpan)} p-4 rounded-xl border ${bgClass}">
        <h3 class="font-bold ${textClass} mb-2 flex items-center gap-2">
            ${severity === 'critical' ? '🚨' : 'ℹ️'} ${title}
        </h3>
        <ul class="space-y-1">
            ${messages.map(m => `<li class="text-sm text-white/80 list-disc list-inside">${m}</li>`).join('')}
        </ul>
    </div>`;
}


function renderTable(comp: TableCard): string {
    const { title, headers, rows, variant } = comp.props;
    const isColored = variant === 'colored-status';

    return `
    <div class="${getColClass(comp.colSpan)} p-0 bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm mt-4">
        <div class="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <h4 class="text-xs font-bold text-white/50 uppercase tracking-widest">${title}</h4>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-white/40 uppercase bg-white/5">
                    <tr>
                        ${headers.map(h => `<th class="px-6 py-3 font-medium tracking-wider">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                    ${rows.map((row, i) => `
                        <tr class="hover:bg-white/5 transition-colors">
                            ${row.map(cell => `<td class="px-6 py-4 text-white/70 whitespace-nowrap font-mono text-xs">${cell}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

function renderChartContainer(comp: ChartCard): string {
    // We render a Canvas ID and attach the JSON config loosely in a data attribute
    // The main Page Template will pick this up and initialize Chart.js
    const configJson = JSON.stringify(comp.props);
    return `
    <div class="${getColClass(comp.colSpan)} p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm relative group">
        <h4 class="text-xs font-bold text-white/40 uppercase mb-4 tracking-widest">${comp.props.title}</h4>
        <div class="h-64 w-full">
            <canvas id="${comp.id}" class="component-chart" data-config='${configJson.replace(/'/g, "&apos;")}'></canvas>
        </div>
    </div>`;
}

function renderGauge(comp: GaugeCard): string {
    // Simple CSS Gauge or just text for now
    return `
    <div class="${getColClass(comp.colSpan)} p-6 bg-white/5 border border-white/10 rounded-2xl">
        <div class="text-sm text-white/40 uppercase tracking-widest mb-2">${comp.props.label}</div>
        <div class="relative w-full h-4 bg-white/10 rounded-full overflow-hidden">
            <div class="absolute top-0 left-0 h-full bg-emerald-500" style="width: ${(comp.props.value / comp.props.max) * 100}%"></div>
        </div>
        <div class="flex justify-between text-xs text-white/40 mt-1">
            <span>${comp.props.min}</span>
            <span class="text-white font-mono">${comp.props.value} ${comp.props.units}</span>
            <span>${comp.props.max}</span>
        </div>
    </div>`;
}

function renderActionGuide(comp: ActionGuideCard): string {
    return `
    <div class="${getColClass(comp.colSpan)} p-6 bg-white/5 border border-white/10 rounded-2xl">
        <div class="text-sm text-white/40 uppercase tracking-widest mb-4">${comp.props.title}</div>
        <div class="space-y-3">
            ${comp.props.items.map(item => `
                <div class="flex items-start gap-3">
                    <div class="mt-1 w-4 h-4 rounded border ${item.priority === 'high' ? 'border-amber-500 bg-amber-500/20' : 'border-white/20'} flex items-center justify-center">
                        ${item.checked ? '<div class="w-2 h-2 bg-white rounded-sm"></div>' : ''}
                    </div>
                    <span class="text-sm ${item.priority === 'high' ? 'text-amber-100 font-medium' : 'text-white/70'}">${item.text}</span>
                </div>
            `).join('')}
        </div>
    </div>`;
}

function renderAdvice(comp: AdviceCard): string {
    const { title, author, content, sentiment } = comp.props;
    
    // Theme Colors
    let borderClass = 'border-purple-500/30';
    let bgClass = 'bg-purple-900/10';
    let textClass = 'text-purple-200';
    let icon = '🧞‍♂️';

    if (sentiment === 'caution') {
        borderClass = 'border-amber-500/30';
        bgClass = 'bg-amber-900/10';
        textClass = 'text-amber-200';
        icon = '⚠️';
    } else if (sentiment === 'positive') {
        borderClass = 'border-emerald-500/30';
        bgClass = 'bg-emerald-900/10';
        textClass = 'text-emerald-200';
        icon = '✅';
    }

    // Parse simple markdown
    let htmlContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
        .split('\n').map(line => {
            if (line.trim().startsWith('- ')) {
                return `<li class="ml-4 list-disc opacity-90">${line.replace('- ', '')}</li>`;
            }
            return `<p class="mb-2">${line}</p>`;
        }).join('');

    return `
    <div class="${getColClass(comp.colSpan)} p-6 rounded-2xl border ${borderClass} ${bgClass} relative overflow-hidden backdrop-blur-md">
        <!-- HEADER -->
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
                <div class="text-2xl filter drop-shadow-md">${icon}</div>
                <div>
                    <h3 class="font-bold text-lg text-white tracking-wide">${title}</h3>
                    ${author ? `<p class="text-[10px] uppercase tracking-widest opacity-50">Voice of ${author}</p>` : ''}
                </div>
            </div>
        </div>

        <!-- CONTENT -->
        <div class="text-sm ${textClass} leading-relaxed font-mono">
            ${htmlContent}
        </div>

        <!-- DECORATION -->
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
    </div>`;
}
