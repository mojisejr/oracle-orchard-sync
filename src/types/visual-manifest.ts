/**
 * 👁️ HEADLESS MANIFEST: The Contract between Brain and Body
 * Phase 1: The Visual Protocol
 * 
 * Defines the JSON structure that the Oracle (Brain) produces and the Dashboard (Body) renders.
 */

// --- 1. THE ROOT MANIFEST ---

export interface HeadlessManifest {
    /** Global Summary or "Tweet" of the current status */
    summary: string;
    
    /** Semantic Theme Token (Body interprets this to colors) */
    theme: 'nominal' | 'watch' | 'critical' | 'emergency-red' | 'calm-green' | 'drought-orange';
    
    /** Layout Strategy ID (Body maps this to Grid CSS) */
    layout: 'dashboard-v1' | 'mobile-focus' | 'minimal-alert';
    
    /** The Ordered List of Visual Components to Render */
    visual_manifest: VisualComponent[];

    /** Metadata for timestamp and generation info */
    meta: {
        generated_at: string; // ISO String
        horizon_days: number;
        version: string; // '1.0'
        generator_agent?: string;
    };
}

// --- 2. THE COMPONENT UNION ---

export type VisualComponent = 
    | PlotCompositeCard // NEW: The Hero Card
    | MetricCard 
    | GaugeCard 
    | ChartCard 
    | TableCard 
    | InsightCard 
    | ActionGuideCard
    | PlotHeaderCard
    | AdviceCard; // NEW: AI-Driven Advice

export type ComponentType = VisualComponent['type'];

// --- 3. COMPONENT DEFINITIONS ---

/**
 * COMPOSITE: The "All-in-One" Plot Card (Hero View)
 */
export interface PlotCompositeCard extends BaseComponent {
    type: 'PLOT_COMPOSITE';
    props: {
        // Identity
        plotName: string;
        stage: string;
        tags: string[];
        
        // Primary Metric (Top Right)
        primaryMetric: {
            label: string;
            value: string | number;
            unit?: string;
        };
        
        // Chart Context
        heroChart: {
            config: any; // Chart.js config data
            title: string;
            desc: string;
        };

        // Activities
        recentActivities?: { date: string; note: string }[];
    };
}


/**
 * Base Props for all components
 */
interface BaseComponent {
    id: string; // Unique ID for React keys / DOM mapping
    colSpan?: 1 | 2 | 3 | 4; // Grid span hint (default 1)
}

/**
 * PLOT HEADER: The Identity Card (Name, Stage, Soil)
 */
export interface PlotHeaderCard extends BaseComponent {
    type: 'PLOT_HEADER';
    props: {
        plotName: string;
        stage: string;
        soilType: string;
        tags?: string[];
    };
}

/**
 * METRIC: Single large number with a label (e.g., "34°C", "Today's GDD")
 */
export interface MetricCard extends BaseComponent {
    type: 'METRIC_CARD';
    props: {
        label: string;
        value: string | number;
        unit?: string;
        trend?: 'up' | 'down' | 'stable';
        trendValue?: string; // e.g. "+5%"
        status?: 'normal' | 'warning' | 'danger'; // Local status override
    };
}

/**
 * GAUGE: Dial or Progress Bar (e.g., VPD 1.2 kPa)
 */
export interface GaugeCard extends BaseComponent {
    type: 'GAUGE_CARD';
    props: {
        label: string;
        value: number;
        min: number;
        max: number;
        units: string;
        zones?: {
            min: number;
            max: number;
            color: string; // Hex or Token
            label?: string;
        }[];
        currentZoneLabel?: string;
    };
}

/**
 * CHART: Time-series or Bar chart
 */
export interface ChartCard extends BaseComponent {
    type: 'CHART';
    props: {
        title: string;
        subtitle?: string;
        /** 
         * 'auto' lets the renderer decide based on data shape.
         * Specific types override the renderer.
         */
        chartType: 'line' | 'bar' | 'mixed' | 'area';
        data: {
            labels: string[];
            datasets: {
                label: string;
                data: (number | null)[];
                color?: string; // Optional override
                type?: 'line' | 'bar'; // Mixed chart support
                yAxisID?: 'y' | 'y1'; // Dual axis support
                fill?: boolean;
            }[];
        };
        xAxisLabel?: string;
        yAxisLabel?: string;
    };
}

/**
 * TABLE: Structured rows (e.g., Activity Logs)
 */
export interface TableCard extends BaseComponent {
    type: 'TABLE_CARD';
    props: {
        title: string;
        headers: string[];
        rows: (string | number | boolean)[][]; // Simple primitive rows
        highlightRowIndex?: number[]; // Highlight specific rows
        variant?: 'simple' | 'colored-status';
    };
}

/**
 * INSIGHT: Text-based analysis or warning
 */
export interface InsightCard extends BaseComponent {
    type: 'INSIGHT_CARD';
    props: {
        title: string;
        severity: 'info' | 'warning' | 'critical';
        messages: string[]; // Bullet points
    };
}

/**
 * ACTION GUIDE: Specific instructions
 */
export interface ActionGuideCard extends BaseComponent {
    type: 'ACTION_GUIDE';
    props: {
        title: string;
        items: {
            text: string;
            checked?: boolean; // For display purposes
            priority?: 'high' | 'normal';
        }[];
    };
}

/**
 * ADVICE: Direct recommendations from AI (Oracle)
 * Supports Markdown-like synthesis
 */
export interface AdviceCard extends BaseComponent {
    type: 'ADVICE_CARD';
    props: {
        title: string;
        /** The Oracle's voice/persona (e.g., "Orchard Sage") */
        author?: string;
        content: string; // Supports simple markdown (bold, list)
        sentiment?: 'neutral' | 'positive' | 'caution';
    };
}
