import { exec } from 'child_process';
import minimist from 'minimist';

// Simple CLI wrapper to chain synthesize -> viz-render with arguments
const args = minimist(process.argv.slice(2));
const plot = args._[0]; // First positional arg is plot slug
const viewMode = args._[1]; // Second positional arg is explicit view mode (vpd, rain, temp)

if (!plot) {
    console.error('Usage: npm run sight <plot_slug> [mode] (e.g., npm run sight tamarind vpd)');
    process.exit(1);
}

console.log(`🦁 Orchard Sight: Focusing on ${plot}${viewMode ? ` [Mode: ${viewMode}]` : ''}...`);

// Corrected logic: 
// 1. We pass --json to synthesize to get raw data
// 2. We pass --plot to synthesize to filter query (efficiency)
// 3. We pass --json to viz-render to tell it to read from STDIN
// 4. We pass --focus to viz-render to filter the specific plot in UI
// 5. We pass --view to viz-render if specified, to override smart logic
// 6. We pass --open to viz-render to launch browser

let command = `npm run synthesize -- --json --plot ${plot} | ts-node src/scripts/viz-render.ts --json --open --focus ${plot}`;
if (viewMode) {
    command += ` --view ${viewMode}`;
}

const child = exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        return;
    }
    if (stderr) {
        // synthesize logs to stderr sometimes for dotenv, ignore unless error
    }
    console.log(stdout);
});

// Pipe output for transparency
child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);
