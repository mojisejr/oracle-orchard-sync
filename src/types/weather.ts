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
