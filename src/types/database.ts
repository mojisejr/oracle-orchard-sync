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

export type DatabaseSchema = {
  public: {
    Tables: {
      activity_logs: {
        Row: ActivityLog;
        Insert: Omit<ActivityLog, 'id' | 'created_at'>;
        Update: Partial<Omit<ActivityLog, 'id' | 'created_at'>>;
      };
      weather_forecasts: {
        Row: {
            id: number;
            location_id: string; // The confusing part (suan-makham vs suan_makham)
            timestamp: string;
            temp_c: number;
            humidity_percent: number;
            rain_mm: number;
            wind_speed_kmh: number;
            summary: string | null;
            created_at: string;
        };
        Insert: {
            location_id: string;
            timestamp: string;
            temp_c: number;
            humidity_percent: number;
            rain_mm: number;
            wind_speed_kmh: number;
            summary?: string | null;
        };
        Update: Partial<{
            location_id: string;
            timestamp: string;
            temp_c: number;
            humidity_percent: number;
            rain_mm: number;
            wind_speed_kmh: number;
            summary?: string | null;
        }>;
      };
    };
  };
};
