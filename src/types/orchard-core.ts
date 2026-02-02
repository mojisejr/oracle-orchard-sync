/**
 * 🛡️ ORCHARD CORE: The Single Source of Truth
 * Phase 1.1: Data Standardization
 * 
 * This file defines the Universal Types for the Orchard Intelligence System.
 * "It doesn't work until it types."
 */

import { PlotProfile } from '../lib/plot-mapper';

// --- 1. THE GARDEN (Identity) ---

export type PlotId = string; // e.g. 'suan_makham', 'suan_ban'

export interface OrchardPlot {
    id: PlotId;
    profile: PlotProfile; // Inherit the robust profile definition
}

// --- 2. THE REALITY (Database/Input Layer) ---

/**
 * Weather Forecast Row (Matches Database Schema Exactness)
 * Based on 'weather_forecasts' table expectations (or TMD API shape mapped to DB)
 */
export interface WeatherForecastDB {
    location_id: string;
    forecast_date: string; // YYYY-MM-DD
    tc_max: number;        // Max Temperature (C)
    tc_min: number;        // Min Temperature (C)
    rh_percent: number;    // Relative Humidity (%)
    rain_prob_percent: number; // Rain Probability (%)
    rain_mm?: number;      // Rain Volume (mm) - Optional in some feeds
    wind_speed?: number;   // Wind Speed (km/h) - Optional in some feeds
    fetched_at?: string;   // Timestamp
}

// --- 3. THE CALCULUS (Agro Metrics) ---

export interface AgroMetrics {
    vpd: number; // Vapor Pressure Deficit (kPa)
    gdd: number; // Growing Degree Days (Accumulated heat units)
    eto: number; // Evapotranspiration (mm/day)
}

// --- 4. THE SITUATION (System Payload) ---

/**
 * Standard Daily Intelegence Unit
 * "Clean" Data for Agents and UI
 */
export interface DailyMetData extends AgroMetrics {
    date: string;        // YYYY-MM-DD
    tempMax: number;     // Normalized from tc_max
    tempMin: number;     // Normalized from tc_min
    humidity: number;    // % Normalized from rh_percent
    rainProb: number;    // %
    rainMm?: number;     // mm (Rainfall Volume)
    condition?: string;  // 'sunny', 'rainy', etc. (Optional descriptive)
}

export interface ActivityContext {
    date: string;
    type: string;        // 'watering', 'spraying'
    notes: string;
    // can extend with more specific details later
}

/**
 * SITREP (Situation Report)
 * The primary payload exchanged between Brain, Memory, and Eye.
 */
export interface SITREP {
    timestamp: string;      // Generation Time (ISO)
    plot: OrchardPlot;      // Who am I?
    
    // The Environment (Past, Present, Future)
    environment: {
        history: DailyMetData[]; // Past 3-7 days (for trend)
        current: DailyMetData;   // Today (or latest forecast)
        forecast: DailyMetData[];// Next 3-7 days
    };

    // The Intervention (Human Actions)
    activities: {
        recent: ActivityContext[];
        planned?: ActivityContext[];
        gapAnalysis?: string[]; // "Haven't sprayed in 15 days"
    };

    // The Wisdom (Synthesis)
    insight?: {
        status: 'nominal' | 'watch' | 'critical';
        headlines: string[];
    };
}

// --- 5. THE SYSTEM (Holistic View) ---

export interface GapAnalysis {
    integrity: 'fresh' | 'stale' | 'critical';
    last_update_hours: number;
    missing_plots: string[];
    external_search_needed: boolean;
    notes: string[];
}

export interface SystemInsight {
    timestamp: string;
    meta: {
        horizon_days: number;
        focus: string[];
    };
    gap_analysis: GapAnalysis;
    plots: Record<string, SITREP>;
}
