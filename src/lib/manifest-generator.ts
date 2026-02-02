/**
 * 🧠 MANIFEST GENERATOR: The Visual Cortex
 * 
 * Transforms raw data (SITREP) into a Visual Manifest based on:
 * 1. Hard Logic (Rules)
 * 2. Soft Logic (Patterns & Learnings)
 */

import { HeadlessManifest, VisualComponent, ChartCard, MetricCard } from '../types/visual-manifest';
import { SITREP, DailyMetData } from '../types/orchard-core';

// --- INTERFACES ---

interface GenerationContext {
    system: {
        timestamp: string;
        plots: Record<string, SITREP>;
    };
    learnings?: any[]; // Placeholder for loaded patterns
}

// --- PATTERN MATCHER ENGINE ---

export function generateManifest(data: GenerationContext['system'], filterPlotId?: string): HeadlessManifest {
    // 1. Analyze Global Context (Aggregated)
    const context = analyzeGlobalContext(data);

    // 2. Determine Theme & Layout
    const theme = context.isEmergency ? 'emergency-red' : 
                  context.isDrought ? 'drought-orange' : 'nominal';
                  
    const layout = context.isMobile ? 'mobile-focus' : 'dashboard-v1';

    // 3. Generate Visual Components
    const components: VisualComponent[] = [];

    // 3.1 Global Summary Card (Insight)
    if (!filterPlotId) {
        components.push({
            type: 'INSIGHT_CARD',
            id: 'global_summary',
            colSpan: 4,
            props: {
                title: context.headline,
                severity: context.isEmergency ? 'critical' : 'info',
                messages: context.bulletPoints
            }
        });
    }

    // 3.2 Per-Plot Cards
    Object.values(data.plots).forEach(sitrep => {
        // Apply focus filter if provided
        if (filterPlotId && sitrep.plot.id !== filterPlotId) return;
        
        const plotComponents = generatePlotComponents(sitrep, context.mode);
        components.push(...plotComponents);
    });

    return {
        summary: filterPlotId ? `Focus: ${filterPlotId.toUpperCase()}` : context.headline,
        theme,
        layout,
        visual_manifest: components,
        meta: {
            generated_at: new Date().toISOString(),
            horizon_days: 3, // Default
            version: "2.0-headless"
        }
    };
}

// --- LOGIC: CONTEXT ANALYZER ---

interface GlobalAnalysis {
    isEmergency: boolean;
    isDrought: boolean;
    isMobile: boolean; // Mock
    headline: string;
    bulletPoints: string[];
    mode: 'vpd' | 'rain' | 'temp' | 'default';
}

function analyzeGlobalContext(data: GenerationContext['system']): GlobalAnalysis {
    // Default State
    let mode: GlobalAnalysis['mode'] = 'default';
    let headline = "Orchard Overview";
    const bullets: string[] = [];
    let isEmergency = false;

    // Scan all plots for critical signals
    const plots = Object.values(data.plots);
    
    // Aggregates
    let maxRain = 0;
    let maxVPD = 0;
    
    plots.forEach(p => {
        const fc = p.environment.forecast;
        const localMaxRain = Math.max(...fc.map(d => d.rainMm || 0));
        const localMaxVPD = Math.max(...fc.map(d => d.vpd || 0));
        
        if (localMaxRain > maxRain) maxRain = localMaxRain;
        if (localMaxVPD > maxVPD) maxVPD = localMaxVPD;

        // CHECK BRAIN INSIGHT (Reflex/Manual Override)
        if (p.insight?.status === 'critical') {
            isEmergency = true;
            headline = `🚨 ${p.insight.headlines[0] || 'CRITICAL ALERT'}`;
            bullets.push(`${p.plot.id}: ${p.insight.headlines.join(', ')}`);
        }
    });

    // Pattern Matching (Moved from viz-render.ts)
    // 1. Flood Risk
    if (isEmergency) {
        mode = 'rain'; // Default to rain/emergency view
    } else if (maxRain > 50) { // Threshold 50mm
        mode = 'rain';
        headline = `⚠ Heavy Rain Alert (${maxRain}mm detected)`;
        isEmergency = true;
        bullets.push(`High precipitation expected in next 3 days.`);
    } 
    // 2. High VPD / Drought
    else if (maxVPD > 2.0) {
        mode = 'vpd';
        headline = `High Transpiration Rate (VPD ${maxVPD.toFixed(2)} kPa)`;
        bullets.push(`Monitor irrigation closely. High water demand.`);
    }

    return {
        isEmergency,
        isDrought: maxVPD > 1.5,
        isMobile: false,
        headline,
        bulletPoints: bullets.length > 0 ? bullets : ['Conditions are nominal.'],
        mode
    };
}

// --- LOGIC: PLOT COMPONENT FACTORY ---

function generatePlotComponents(sitrep: SITREP, globalMode: GlobalAnalysis['mode']): VisualComponent[] {
    const profile = sitrep.plot.profile;
    const criticalAsset = (profile.personality.critical_asset || '').toLowerCase();
    const stage = (profile.stage || '').toLowerCase();

    // 2. Contextual Chart Logic (The "Smart Logic")
    let localMode = globalMode;

    if (criticalAsset === 'durian' || stage === 'bloom' || stage === 'pollination') {
        localMode = 'vpd';
    } else if (profile.personality.sensitivity_flood > 7 || profile.soil.includes('clayey_filled')) {
        localMode = 'rain';
    } else if (criticalAsset === 'seedling') {
        localMode = 'temp';
    }

    // Chart Data Preparation
    const forecasts = sitrep.environment.forecast;
    const labels = forecasts.map(f => f.date.split('T')[0].slice(5)); // MM-DD

    let chartDataset: any[] = [];
    let chartTitle = 'General Forecast';
    let chartDesc = 'Monitoring conditions';
    let chartType: 'line' | 'bar' | 'mixed' = 'line';

    if (localMode === 'vpd') {
        chartTitle = 'VPD & Stress Index';
        chartDesc = 'Transpiration Monitor';
        chartDataset = [{
            label: 'VPD (kPa)',
            data: forecasts.map(f => f.vpd),
            color: '#10b981', // Emerald
            fill: true
        }];
    } else if (localMode === 'rain') {
        chartTitle = 'Precipitation & Flood Risk';
        chartDesc = 'Flood Watch';
        chartType = 'mixed';
        chartDataset = [
            {
                label: 'Rain (mm)',
                data: forecasts.map(f => f.rainMm || 0),
                color: '#3b82f6', // Blue
                type: 'bar'
            },
            {
                label: 'ETo (mm)',
                data: forecasts.map(f => f.eto),
                color: '#f59e0b',
                type: 'line'
            }
        ];
    } else if (localMode === 'temp') {
        chartTitle = 'Heat Stress (Max Temp)';
        chartDesc = 'Heat Watch';
        chartDataset = [{
            label: 'Max Temp (°C)',
            data: forecasts.map(f => f.tempMax),
            color: '#ef4444',
            fill: true
        }];
    } else {
        chartType = 'mixed';
        chartDataset = [
            {
                label: 'Max Temp',
                data: forecasts.map(f => f.tempMax),
                color: '#6366f1',
                type: 'line'
            },
            {
                label: 'Rain %',
                data: forecasts.map(f => f.rainProb),
                color: '#3b82f6',
                type: 'bar'
            }
        ];
    }

    // Determine Metric
    let metricVal = 0;
    let metricLabel = 'Daily GDD';
    
    if (localMode === 'rain') {
        metricVal = forecasts.reduce((sum, f) => sum + (f.rainMm || 0), 0);
        metricLabel = 'Rain (3d)';
    } else {
        metricVal = sitrep.environment.current.gdd || 0;
    }


    // Return SINGLE COMPOSITE CARD
    const result: VisualComponent[] = [{
        type: 'PLOT_COMPOSITE',
        id: `plot_${sitrep.plot.id}`,
        colSpan: 1,
        props: {
            plotName: sitrep.plot.id,
            stage: profile.stage,
            tags: [criticalAsset, profile.soil],
            primaryMetric: {
                label: metricLabel,
                value: metricVal.toFixed(1)
            },
            heroChart: {
                title: chartTitle,
                desc: chartDesc,
                config: {
                    chartType,
                    data: {
                        labels,
                        datasets: chartDataset
                    }
                }
            },
            recentActivities: sitrep.activities.recent.slice(0, 2).map(a => ({
                date: a.date,
                note: a.notes
            }))
        }
    }];

    // 🔬 DYNAMIC INJECTION: Activity Table for requested plot (Focus)
    if (sitrep.plot.id === 'suan_makham') {
        const activityRows = sitrep.activities.recent.slice(0, 10).map(a => {
            const dateStr = new Date(a.date).toLocaleDateString('th-TH', { 
                day: '2-digit', 
                month: '2-digit',
                year: '2-digit'
            });
            return [dateStr, a.type.toUpperCase(), a.notes || '-'];
        });

        result.push({
            type: 'TABLE_CARD',
            id: `activity_table_${sitrep.plot.id}`,
            colSpan: 4, // Full width for visibility
            props: {
                title: `📅 Activity History: ${sitrep.plot.id.toUpperCase()}`,
                variant: 'simple',
                headers: ['Date', 'Type', 'Notes'],
                rows: activityRows
            }
        });
    }

    return result;
}



