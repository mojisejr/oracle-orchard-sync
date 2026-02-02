
import minimist from 'minimist';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { exec } from 'child_process';
import { SITREP } from '../types/orchard-core';
import { HeadlessManifest } from '../types/visual-manifest';
import { renderComponent, generatePageTemplate } from '../lib/html-renderer';
import { generateManifest } from '../lib/manifest-generator';

const args = minimist(process.argv.slice(2));

// This determines the Contract: "SystemInsight" (Legacy) or "HeadlessManifest" (Phase 3)
type InputPayload = 
    | { kind: 'legacy'; data: { timestamp: string; plots: Record<string, SITREP> } }
    | { kind: 'manifest'; data: HeadlessManifest };

async function main() {
    // 1. Read & Parse Input
    if (!args.json) {
        console.error('Usage: ... | ts-node viz-render.ts --json [--open]');
        process.exit(1);
    }

    const rawInputString = await readStdin();
    if (!rawInputString) process.exit(1);

    const payload = parsePayload(rawInputString);

    // 2. Normalize to Manifest
    let manifest: HeadlessManifest;

    if (payload.kind === 'legacy') {
        console.warn('⚠️  Received Legacy SystemInsight. Auto-converting to Manifest (Phase 2 Shim).');
        manifest = generateManifest({
            timestamp: payload.data.timestamp,
            plots: payload.data.plots
        }, args.plot);
    } else {
        manifest = payload.data;
        console.log('✅ Received Headless Manifest (Phase 3 Native).');
    }

    // 3. Render HTML Loop (Phase 3)
    const plotsHtml = manifest.visual_manifest.map(comp => renderComponent(comp)).join('\n');
    
    // 4. Generate Page Wrapper
    const finalHtml = generatePageTemplate(manifest, plotsHtml);

    // 5. Write Output
    const outputPath = resolve(__dirname, '../../out/dashboard.html');
    writeFileSync(outputPath, finalHtml);
    console.log(`✅ Dashboard generated at: ${outputPath}`);

    if (args.open) exec(`open ${outputPath}`);
}

// --- HELPERS ---

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf-8');
}

function parsePayload(input: string): InputPayload {
    try {
        const firstBrace = input.indexOf('{');
        const lastBrace = input.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON brackets');
        
        const json = JSON.parse(input.substring(firstBrace, lastBrace + 1));
        
        if ('visual_manifest' in json) {
            return { kind: 'manifest', data: json as HeadlessManifest };
        } else if ('plots' in json) {
            return { kind: 'legacy', data: json };
        } else {
             // Fallback default
             console.warn('⚠️ Unknown payload format. Assuming empty legacy.');
             return { kind: 'legacy', data: { timestamp: new Date().toISOString(), plots: {} } };
        }
    } catch (e: any) {
        // console.error('JSON Parse Error:', e.message);
        // Fallback for empty/error input to prevent crash
        return { kind: 'legacy', data: { timestamp: new Date().toISOString(), plots: {} } };
    }
}

// generatePageTemplate moved to ../lib/html-renderer.ts

main().catch(e => console.error(e));
