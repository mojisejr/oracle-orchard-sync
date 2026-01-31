// Temporary file to hold legacy types until they are fully migrated or replaced
// This allows us to delete the old files while keeping the code compiling during transition

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

export type ActivityType = 'watering' | 'spraying' | 'monitoring' | 'fertilizing' | 'pruning' | 'other';

export interface ActivityLog {
  id: string;
  created_at: string;
  user_id?: string;
  activity_type: ActivityType;
  plot_name: string;
  tree_id?: string;
  details: Record<string, any>;
  notes?: string;
  next_action?: {
    action: string;
    days?: number;
    reminder_date?: string;
    status: 'pending' | 'completed' | 'skipped';
    completed_at?: string;
  };
}
