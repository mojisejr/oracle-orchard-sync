"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("../lib/supabase");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Define the path to the farming logs directory
// Going up from src/scripts -> projects/orchard-sync -> projects -> root -> ψ/memory/logs/orchard/farming/
const FARMING_LOGS_DIR = path.resolve(__dirname, '../../../../ψ/memory/logs/orchard/farming');
async function main() {
    console.log('🍎 Starting Orchard Sync...');
    // 1. Determine "Today" (Local Time - GMT+7 awareness)
    // We want to fetch logs created "today" relative to the user's local time.
    const now = new Date();
    const dateString = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const startOfDay = new Date(dateString + 'T00:00:00+07:00').toISOString();
    const endOfDay = new Date(dateString + 'T23:59:59+07:00').toISOString();
    console.log(`📅 Syncing logs for: ${dateString}`);
    console.log(`   Time range: ${startOfDay} - ${endOfDay}`);
    // 2. Fetch data from Supabase
    const { data: logs, error } = await supabase_1.supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: true });
    if (error) {
        console.error('❌ Error fetching logs:', error.message);
        process.exit(1);
    }
    if (!logs || logs.length === 0) {
        console.log('ℹ️ No activity logs found for today.');
        // We might still want to create the file or just exit. 
        // For now, let's exit to avoid empty files if that's preferred, 
        // OR create an empty placeholder. Let's creating nothing for now.
        return;
    }
    console.log(`✅ Found ${logs.length} activities.`);
    // 3. Group by Plot Name (Orchard Name)
    // We create one file per Orchard per Day: YYYY-MM-DD_[plot_name].md
    const logsByPlot = {};
    logs.forEach((log) => {
        const plot = log.plot_name || 'unknown-plot';
        if (!logsByPlot[plot]) {
            logsByPlot[plot] = [];
        }
        logsByPlot[plot].push(log);
    });
    // 4. Generate Markdown Files
    // Ensure directory exists
    if (!fs.existsSync(FARMING_LOGS_DIR)) {
        console.log(`📁 Creating directory: ${FARMING_LOGS_DIR}`);
        fs.mkdirSync(FARMING_LOGS_DIR, { recursive: true });
    }
    for (const [plotName, plotLogs] of Object.entries(logsByPlot)) {
        // Sanitize plot name for filename
        const safePlotName = plotName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const filename = `${dateString}_${safePlotName}.md`;
        const filePath = path.join(FARMING_LOGS_DIR, filename);
        const fileContent = generateMarkdown(dateString, plotName, plotLogs);
        // Write file (Synchronous for safety)
        try {
            // Check if file exists to determine if we are updating or creating
            // Actually, since we pulled *all* logs for today, we probably want to overwrite 
            // the day's file to ensure it reflects the DB state exactly (Source of Truth).
            // Or we can append? 
            // The requirement says "Append/Create".
            // If we run this script multiple times a day, "Append" might duplicate entries if we aren't careful.
            // Strategy: Re-generate the *entire day's* log based on DB state. This is cleaner and idempotent.
            fs.writeFileSync(filePath, fileContent, 'utf8');
            console.log(`📝 Wrote log: ${filename}`);
        }
        catch (err) {
            console.error(`❌ Failed to write file ${filename}:`, err);
        }
    }
    console.log('✨ Sync complete.');
}
function generateMarkdown(date, plotName, logs) {
    // Group details by activity type for better readability
    const groupedLogs = {};
    logs.forEach(log => {
        if (!groupedLogs[log.activity_type])
            groupedLogs[log.activity_type] = [];
        groupedLogs[log.activity_type].push(log);
    });
    let md = `# 🍎 Daily Farming Log: ${plotName}\n\n`;
    md += `**Date**: ${date}\n`;
    md += `**Total Activities**: ${logs.length}\n`;
    md += `**Generated By**: Orchard-Sync Engine\n\n`;
    md += `---\n\n`;
    for (const [type, activities] of Object.entries(groupedLogs)) {
        const icon = getActivityIcon(type);
        md += `## ${icon} ${capitalize(type)}\n\n`;
        activities.forEach(log => {
            const time = new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            md += `- **${time}**: ${log.notes || 'No notes'}\n`;
            // Render details based on type
            if (log.details && Object.keys(log.details).length > 0) {
                md += `  - *Details*: ${formatDetails(log.details)}\n`;
            }
            if (log.tree_id) {
                md += `  - *Tree*: \`${log.tree_id}\`\n`;
            }
            if (log.next_action) {
                const next = log.next_action;
                const statusIcon = next.status === 'completed' ? '✅' : '⏳';
                md += `  - *Next Action*: ${statusIcon} ${next.action} (Due: ${next.reminder_date ? next.reminder_date.substring(0, 10) : 'N/A'})\n`;
            }
            md += `\n`;
        });
    }
    return md;
}
function getActivityIcon(type) {
    switch (type) {
        case 'watering': return '💧';
        case 'spraying': return '🚿';
        case 'fertilizing': return '🌱';
        case 'pruning': return '✂️';
        case 'monitoring': return '👀';
        default: return '📝';
    }
}
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatDetails(details) {
    return Object.entries(details)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
}
main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
