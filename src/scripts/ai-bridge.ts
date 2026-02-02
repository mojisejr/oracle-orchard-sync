import { HeadlessManifest, AdviceCard, VisualComponent, MetricCard } from '../types/visual-manifest';
import minimist from 'minimist';

// Simulation of "AI Logic" - In the future, this will call the LLM or check robust heuristic rules.
// For now, it is the "Orchard Sage" logic in code form.

const args = minimist(process.argv.slice(2));

async function main() {
    // 1. Ingest Data (Simulated or Real)
    // In a real scenario, this might read from a DB or API.
    // For now, we accept a simple status flag or default to normal.
    const status = args.status || 'normal'; // 'normal' | 'drought' | 'flood'

    // 2. AI Reasoning (The "Brain")
    // "Given the status is X, what should I show?"
    
    // Default Manifest Shell
    const manifest: HeadlessManifest = {
        meta: {
            generated_at: new Date().toISOString(),
            version: '1.0.0',
            horizon_days: 1,
            generator_agent: 'orchard-sage-v1'
        },
        theme: status === 'drought' || status === 'flood' ? 'emergency-red' : 'calm-green',
        layout: 'dashboard-v1',
        summary: status === 'normal' ? 'Orchard Operations Nominal' : `CRITICAL ALERT: ${status.toUpperCase()}`,
        visual_manifest: []
    };

    // Logic: Synthesize Components based on Insight
    const components: VisualComponent[] = [];

    // Component 1: The Advice (The Voice of Oracle)
    if (status === 'drought') {
        components.push({
            id: 'monitor-1',
            type: 'ADVICE_CARD',
            props: {
                title: 'Drought Protocol Activated',
                sentiment: 'caution',
                content: `
### ⚠️ Critical Water Deficit
Current moisture levels are **20% below target**. 

**Recommended Actions:**
- [ ] Activate Auxiliary Pump A
- [ ] Reduce irrigation interval to 4 hours
- [ ] Inspect localized drip lines for blockages
                `
            }
        });
    } else if (status === 'flood') {
        components.push({
            id: 'monitor-1',
            type: 'ADVICE_CARD',
            props: {
                title: 'Flood Risk Detected',
                sentiment: 'caution',
                content: `
### 🌊 Water Level Rising
Heavy rainfall detected in Sector 4.

**Recommended Actions:**
- [ ] Open drainage valves
- [ ] Move sensitive equipment to high ground
- [ ] Monitor Canal B levels
                `
            }
        });
    } else {
        components.push({
            id: 'monitor-1',
            type: 'ADVICE_CARD',
            props: {
                title: 'Daily Farming Insight',
                sentiment: 'neutral',
                content: `
### 🌿 Operations Normal
Soil moisture is optimal. No irregularities detected in the last 24 hours.

**Suggestion:**
Consider a preventative nutrient spray in Sector 2 due to upcoming overcast weather.
                `
            }
        });
    }

    // Component 2: The Main Chart (Visual Proof)
    // We synthesize data to match the narrative
    const dataPoints = status === 'drought' 
        ? [30, 28, 25, 22, 20, 18, 15] 
        : status === 'flood'
        ? [70, 75, 80, 85, 90, 92, 95]
        : [50, 52, 49, 51, 53, 50, 52];

    components.push({
        id: 'chart-main',
        type: 'CHART',
        props: {
            title: 'Soil Moisture Trends',
            chartType: 'line',
            data: {
                labels: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'NOW'],
                datasets: [
                    {
                        label: 'Moisture (%)',
                        data: dataPoints,
                        color: status === 'drought' ? '#f87171' : status === 'flood' ? '#38bdf8' : '#34d399',
                        fill: true
                    }
                ]
            }
        }
    });

    // Component 3: Key Metrics (The "Pulse")
    components.push({
        id: 'metric-1',
        type: 'METRIC_CARD',
        props: {
            label: 'Pump Efficiency',
            value: 98.5,
            unit: '%',
            trend: 'stable'
        }
    });

    manifest.visual_manifest = components;

    // 3. Output JSON
    console.log(JSON.stringify(manifest, null, 2));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
