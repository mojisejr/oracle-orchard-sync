import { parseArgs } from 'node:util';
import { supabase } from '../lib/supabase';
import { ActivityType } from '../types/database';

async function main() {
  const { values } = parseArgs({
    options: {
      type: {
        type: 'string',
        short: 't',
      },
      plot: {
        type: 'string',
        short: 'p',
      },
      notes: {
        type: 'string',
        short: 'n',
      },
      'next-action': {
        type: 'string',
      },
      'next-days': {
        type: 'string',
        default: '7',
      },
    },
  });

  if (!values.type || !values.plot) {
    console.error('❌ Error: Missing required arguments: --type and --plot');
    console.error('Usage: npm run add -- --type <type> --plot <name> [--notes <notes>]');
    process.exit(1);
  }

  // Validate Type
  const validTypes: ActivityType[] = ['watering', 'spraying', 'monitoring', 'fertilizing', 'pruning', 'other'];
  if (!validTypes.includes(values.type as ActivityType)) {
    console.error(`❌ Error: Invalid activity type. Valid types: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  const activityType = values.type as ActivityType;
  const plotName = values.plot;
  const notes = values.notes || '';
  
  // Prepare Insert Data
  // We explicitly match the database schema
  const insertData: any = {
    activity_type: activityType,
    plot_name: plotName,
    details: {}, 
    notes: notes,
  };

  // Handle Next Action
  if (values['next-action']) {
    const days = parseInt(values['next-days'] || '7', 10);
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + days);

    insertData.next_action = {
      action: values['next-action'],
      days: days,
      reminder_date: reminderDate.toISOString().split('T')[0], // YYYY-MM-DD
      status: 'pending'
    };
  }

  // Insert to DB
  console.log('🚀 Inserting activity log...');
  
  const { data, error } = await supabase
    .from('activity_logs')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('❌ Insert failed:', error.message);
    process.exit(1);
  }

  console.log(`✅ Success! Log ID: ${data.id}`);
  // Output JSON for AI Parsing
  console.log(JSON.stringify(data));
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
