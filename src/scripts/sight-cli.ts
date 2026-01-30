import { exec } from 'child_process';
import minimist from 'minimist';

// Simple CLI wrapper to chain synthesize -> viz-render with arguments
const args = minimist(process.argv.slice(2));
const plot = args._[0]; // First positional arg is plot slug

if (!plot) {
    console.error('Usage: npm run sight <plot_slug> (e.g., npm run sight tamarind)');
    process.exit(1);
}

console.log(`🦁 Orchard Sight: Focusing on ${plot}...`);

// Corrected logic: 
// 1. We pass --json to synthesize to get raw data
// 2. We pass --plot to synthesize to filter query (efficiency)
// 3. We pass --focus to viz-render to force correct visual Logic
// 4. We pass --open to viz-render to launch browser

const command = `npm run synthesize -- --json --plot ${plot} | ts-node src/scripts/viz-render.ts --open --focus ${plot}`;

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
