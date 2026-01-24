/**
 * Weather Logic Core Types
 * Based on Lab: ψ/lab/orchard/tmd-operational/
 */

export interface WeatherStamp {
  timestamp: string;      // ISO string (Result time)
  temp_c: number;         // Temperature (C)
  humidity_percent: number; // Relative Humidity (%)
  rain_mm: number;        // Rain (mm)
  wind_speed_kmh: number;   // Wind Speed (km/h)
}

export interface WeatherAdvice {
  condition: string;
  status: 'safe' | 'warning' | 'danger';
  message: string;
}

// Internal Shape for TMD API Response
export interface TmdHourlyResponse {
  WeatherForecasts: Array<{
    location: {
      lat: number;
      lon: number;
    };
    forecasts: Array<{
      time: string;
      data: {
        tc: number;    // Temperature
        rh: number;    // Relative Humidity
        rain: number;  // Rain (mm)
        ws10m: number; // Wind speed at 10m (m/s)
      };
    }>;
  }>;
}

// Phase 1 Schema: Daily Forecast Row
export interface DailyForecast {
  id?: string;
  forecast_date: string; // YYYY-MM-DD
  location_id: string;
  swdown: number;
  tc_max: number;
  tc_min: number;
  rh_percent: number;
  rain_mm: number;
  fetched_at?: string;
}

// Phase 2 Schema: Insight Row
export interface WeatherInsight {
  location_id: string;
  target_date: string;
  category: 'irrigation' | 'disease' | 'physiology';
  status_level: 'critical' | 'warning' | 'optimal' | 'info';
  message: string;
  trigger_data: any;
}
