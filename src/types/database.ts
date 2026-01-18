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
    };
  };
};
