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

export function generateManifest(data: GenerationContext['system']): HeadlessManifest {
    // 1. Analyze Global Context (Aggregated)
    const context = analyzeGlobalContext(data);

    // 2. Determine Theme & Layout
    const theme = context.isEmergency ? 'emergency-red' : 
                  context.isDrought ? 'drought-orange' : 'nominal';
                  
    const layout = context.isMobile ? 'mobile-focus' : 'dashboard-v1';

    // 3. Generate Visual Components
    const components: VisualComponent[] = [];

    // 3.1 Global Summary Card (Insight)
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

    // 3.2 Per-Plot Cards
    Object.values(data.plots).forEach(sitrep => {
        const plotComponents = generatePlotComponents(sitrep, context.mode);
        components.push(...plotComponents);
    });

    return {
        summary: context.headline,
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
    });

    // Pattern Matching (Moved from viz-render.ts)
    // 1. Flood Risk
    if (maxRain > 50) { // Threshold 50mm
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
    const comps: VisualComponent[] = [];
    const profile = sitrep.plot.profile;
    const profileNote = (profile.personality.notes || '').toLowerCase();
    const criticalAsset = (profile.personality.critical_asset || '').toLowerCase();
    const stage = (profile.stage || '').toLowerCase();

    // 1. Plot Header
    comps.push({
        type: 'PLOT_HEADER',
        id: `header_${sitrep.plot.id}`,
        colSpan: 1, // Standard card width
        props: {
            plotName: sitrep.plot.id,
            stage: profile.stage,
            soilType: profile.soil,
            tags: [criticalAsset]
        }
    });

    // 2. Contextual Chart (The "Smart Logic" from Body)
    // Local Override: specific plot sensitivity
    let localMode = globalMode;

    if (criticalAsset === 'durian' || stage === 'bloom' || stage === 'pollination') {
        localMode = 'vpd'; // Durable Rule: Durian always cares about VPD in bloom
    } else if (profile.personality.sensitivity_flood > 7 || profile.soil.includes('clayey_filled')) {
        localMode = 'rain'; // Durable Rule: Clay soil fears flood
    } else if (criticalAsset === 'seedling') {
        localMode = 'temp';
    }

    // Generate Chart Data
    const forecasts = sitrep.environment.forecast;
    const labels = forecasts.map(f => f.date.split('T')[0].slice(5)); // MM-DD

    let chartCard: ChartCard;

    if (localMode === 'vpd') {
        chartCard = {
            type: 'CHART',
            id: `chart_${sitrep.plot.id}`,
            colSpan: 1,
            props: {
                title: 'VPD & Stress Index',
                chartType: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'VPD (kPa)',
                        data: forecasts.map(f => f.vpd),
                        color: '#10b981', // Emerald
                        fill: true
                    }]
                }
            }
        };
    } else if (localMode === 'rain') {
        chartCard = {
            type: 'CHART',
            id: `chart_${sitrep.plot.id}`,
            colSpan: 1,
            props: {
                title: 'Precipitation & Flood Risk',
                chartType: 'mixed',
                data: {
                    labels,
                    datasets: [
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
                    ]
                }
            }
        };
    } else if (localMode === 'temp') {
        chartCard = {
            type: 'CHART',
            id: `chart_${sitrep.plot.id}`,
            colSpan: 1,
            props: {
                title: 'Heat Stress (Max Temp)',
                chartType: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Max Temp (°C)',
                        data: forecasts.map(f => f.tempMax),
                        color: '#ef4444',
                        fill: true
                    }]
                }
            }
        };
    } else {
        // Default
        chartCard = {
            type: 'CHART',
            id: `chart_${sitrep.plot.id}`,
            colSpan: 1,
            props: {
                title: 'General Forecast',
                chartType: 'mixed',
                data: {
                    labels,
                    datasets: [
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
                    ]
                }
            }
        };
    }

    comps.push(chartCard);

    // 3. Metric Card (GDD or Rain Sum)
    if (localMode === 'rain') {
        const totalRain = forecasts.reduce((sum, f) => sum + (f.rainMm || 0), 0);
        comps.push({
            type: 'METRIC_CARD',
            id: `metric_${sitrep.plot.id}`,
            colSpan: 1,
            props: {
                label: '3-Day Rain',
                value: totalRain.toFixed(1),
                unit: 'mm',
                status: totalRain > 30 ? 'warning' : 'normal'
            }
        });
    } else {
        const gdd = sitrep.environment.current.gdd || 0;
        comps.push({
            type: 'METRIC_CARD',
            id: `metric_${sitrep.plot.id}`,
            colSpan: 1,
            props: {
                label: 'Daily GDD',
                value: gdd.toFixed(1),
                status: 'normal'
            }
        });
    }

    return comps;
}
