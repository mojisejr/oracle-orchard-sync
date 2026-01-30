import fs from 'fs';
import path from 'path';
import minimist from 'minimist';
import { exec } from 'child_process';

// Args
const args = minimist(process.argv.slice(2));
const VIEW_MODE = args.view || 'strategic';
const OPEN_BROWSER = args.open || false;

// Paths
const TEMPLATE_PATH = path.join(__dirname, '../templates/viz/dashboard.ejs');
const OUTPUT_DIR = path.join(__dirname, '../../out');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'dashboard.html');

/**
 * Reads data from stdin
 */
function readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = '';
        const stdin = process.stdin;

        if (stdin.isTTY) {
            console.log('Orchard Sight Renderer: Waiting for JSON input via pipe...');
        }

        stdin.setEncoding('utf8');
        
        stdin.on('data', chunk => {
            data += chunk;
        });

        stdin.on('end', () => {
            resolve(data);
        });

        stdin.on('error', err => {
            reject(err);
        });
    });
}

/**
 * Main Renderer Logic
 */
async function main() {
    try {
        // 1. Ensure output directory exists
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        // 2. Read Input Data
        const rawInput = await readStdin();
        let inputData: any;
        
        try {
            inputData = JSON.parse(rawInput);
        } catch (e) {
            console.warn('⚠️  No valid JSON input received. Rendering with minimal Shell Data.');
            inputData = { 
                meta: { 
                    generatedAt: new Date().toISOString(), 
                    viewMode: VIEW_MODE,
                    version: '3.0.0-shell' 
                },
                hud: [{ label: 'Status', value: 'No Data', color: 'text-slate-500' }],
                hero: null
            };
        }

        // 3. Inject Metadata override
        inputData.meta = {
            ...inputData.meta,
            viewMode: VIEW_MODE,
            renderedAt: new Date().toISOString()
        };

        // 4. Read Template
        if (!fs.existsSync(TEMPLATE_PATH)) {
            throw new Error(`Template not found at: ${TEMPLATE_PATH}`);
        }
        let templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

        // 5. Injection Strategy (Regex Replacement)
        // We look for the specific block defined in the template
        const injectionTarget = /const INJECTED_DATA = \{[\s\S]*?\};/;
        const injectedPayload = `const INJECTED_DATA = ${JSON.stringify(inputData, null, 4)};`;
        
        if (!injectionTarget.test(templateContent)) {
            throw new Error('Injection point "const INJECTED_DATA = { ... };" not found in template.');
        }
        
        const renderedHtml = templateContent.replace(injectionTarget, injectedPayload);

        // 6. Write Output
        fs.writeFileSync(OUTPUT_FILE, renderedHtml);
        console.log(`✅ Dashboard rendered to: ${OUTPUT_FILE}`);

        // 7. Auto-Open
        if (OPEN_BROWSER) {
            const command = process.platform === 'darwin' ? 'open' : 
                          process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${command} ${OUTPUT_FILE}`);
        }

    } catch (err) {
        console.error('❌ Render Failed:', err);
        process.exit(1);
    }
}

main();
