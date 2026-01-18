import { supabase } from '../lib/supabase';
import { ActivityLog } from '../types/database';
import * as fs from 'fs';
import * as path from 'path';

// Define the path to the farming logs directory
const FARMING_LOGS_DIR = path.resolve(__dirname, '../../../../ψ/memory/logs/orchard/farming');
const SUMMARY_FILE = path.join(FARMING_LOGS_DIR, 'outstanding-tasks.md');

async function main() {
  console.log('🔔 Starting Orchard Remind Agent...');

  // 1. Fetch "Pending" Activities
  // We look for any record that has a next_action->status === 'pending'
  // Note: JSONB querying in Supabase/Postgres is powerful but can be tricky.
  // We'll fetch pending items and filter locally for flexibility in this MVP phase.
  // Optimization: In Phase 3, we can create a DB Index on next_action->>status and query directly.
  
  // Fetch reasonable range of logs (e.g., last 30 days to catch active tasks)
  // or just fetch all active? For MVP, let's fetch pending tasks specifically if possible, 
  // or fetch recent logs and filter.
  // Actually, let's try to filter by the JSONB column directly for efficiency.
  
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('*')
    // Filter where next_action->>status is 'pending'
    // Reference: https://supabase.com/docs/reference/javascript/eq
    .eq('next_action->>status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching pending logs:', error.message);
    process.exit(1);
  }

  if (!logs || logs.length === 0) {
    console.log('✅ No pending tasks found. You are all caught up!');
    writeSummaryFile([]);
    return;
  }

  console.log(`🔎 Found ${logs.length} pending tasks.`);
  
  // 2. Process & Sort Logic
  // We need to categorize them:
  // - Overdue (reminder_date < today)
  // - Today (reminder_date == today)
  // - Upcoming (reminder_date > today)
  
  // Current time in Thailand (GMT+7) for comparison
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
  
  const overdue: ActivityLog[] = [];
  const today: ActivityLog[] = [];
  const upcoming: ActivityLog[] = [];
  const noDate: ActivityLog[] = [];

  (logs as ActivityLog[]).forEach(log => {
     const reminderDate = log.next_action?.reminder_date;
     
     if (!reminderDate) {
         noDate.push(log);
         return;
     }

     // Compare dates (Simple string comparison works for ISO YYYY-MM-DD)
     const reminderDay = reminderDate.substring(0, 10);
     
     if (reminderDay < todayStr) {
         overdue.push(log);
     } else if (reminderDay === todayStr) {
         today.push(log);
     } else {
         upcoming.push(log);
     }
  });

  // 3. Generate "Outstanding Tasks" Markdown
  // Combine all categories into a structure that generateMarkdown can consume
  const allTasks = { overdue, today, upcoming, noDate };
  writeSummaryFile(allTasks);
  
  console.log('✨ Reminder check complete. Summary updated.');
}

function writeSummaryFile(categories: any) {
    // Ensure directory exists
    if (!fs.existsSync(FARMING_LOGS_DIR)) {
        fs.mkdirSync(FARMING_LOGS_DIR, { recursive: true });
    }

    const { overdue, today, upcoming, noDate } = categories;
    const totalCount = (overdue?.length || 0) + (today?.length || 0) + (upcoming?.length || 0) + (noDate?.length || 0);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-CA');

    let md = `# 📋 Outstanding Farming Tasks\n`;
    md += `*Last updated: ${dateStr} ${timeStr} (GMT+7)*\n`;
    
    if (totalCount === 0) {
        md += `\n🎉 **All Caught Up!** No pending tasks in the orchard.\n`;
        fs.writeFileSync(SUMMARY_FILE, md, 'utf8');
        return;
    }

    // 🚨 Overdue Section
    if (overdue && overdue.length > 0) {
        md += `\n## 🚨 Overdue (ค้างชำระ)\n`;
        overdue.forEach((log: ActivityLog) => md += formatTaskItem(log, 'overdue'));
    }

    // 📅 Today Section
    if (today && today.length > 0) {
        md += `\n## 📅 Today's Tasks (วันนี้)\n`;
        today.forEach((log: ActivityLog) => md += formatTaskItem(log, 'today'));
    }

    // 🔭 Upcoming Section
    if (upcoming && upcoming.length > 0) {
        md += `\n## 🔭 Upcoming (เร็วๆ นี้)\n`;
        upcoming.forEach((log: ActivityLog) => md += formatTaskItem(log, 'upcoming'));
    }
    
    // 📝 No Date Section
    if (noDate && noDate.length > 0) {
        md += `\n## 📝 Unscheduled (ยังไม่ระบุวัน)\n`;
        noDate.forEach((log: ActivityLog) => md += formatTaskItem(log, 'nodate'));
    }

    fs.writeFileSync(SUMMARY_FILE, md, 'utf8');
    console.log(`📝 Wrote summary to: ${SUMMARY_FILE}`);
}

function formatTaskItem(log: ActivityLog, type: string): string {
    const next = log.next_action!;
    const dueDate = next.reminder_date ? next.reminder_date.substring(0, 10) : 'No Date';
    const originalDate = new Date(log.created_at).toLocaleDateString('en-CA');
    const daysDiff = next.days ? `(${next.days} days loop)` : '';
    
    // Icon
    let icon = '⬜';
    if (type === 'overdue') icon = '🔴';
    if (type === 'today') icon = '🟡';
    if (type === 'upcoming') icon = '🟢';

    // Format: - [ ] **Due: YYYY-MM-DD**: Task Name (from Origin Activity)
    return `- [ ] ${icon} **${dueDate}**: ${next.action} ${daysDiff}\n` + 
           `      <small>Origin: ${log.activity_type} at ${log.plot_name} on ${originalDate}</small>\n`;
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
