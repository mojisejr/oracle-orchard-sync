/**
 * 🎨 HTML COMPONENT FACTORY
 * Phase 3: The Dumb Renderer Logic
 * 
 * Transforms VisualComponents into HTML strings.
 * Zero business logic allowed here. Only presentation logic.
 */

import { VisualComponent, MetricCard, ChartCard, TableCard, InsightCard, PlotHeaderCard, GaugeCard, ActionGuideCard } from '../types/visual-manifest';

// --- MAIN FACTORY ---

export function renderComponent(comp: VisualComponent): string {
    switch (comp.type) {
        case 'METRIC_CARD': return renderMetric(comp as MetricCard);
        case 'CHART': return renderChartContainer(comp as ChartCard); // Just the container + config script
        case 'INSIGHT_CARD': return renderInsight(comp as InsightCard);
        case 'PLOT_HEADER': return renderPlotHeader(comp as PlotHeaderCard);
        case 'METRIC_CARD': return renderMetric(comp as MetricCard); // Duplicate case removed in transpilation, but for clarity
        case 'GAUGE_CARD': return renderGauge(comp as GaugeCard);
        case 'ACTION_GUIDE': return renderActionGuide(comp as ActionGuideCard);
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
