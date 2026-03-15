import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { buildManifest } from './manifest.js';

const VENDOR_DIR = 'vendor';
const DATA_DIR = 'data';

async function main() {
  console.log('Phase 0: Building manifest...');
  const previousMeta = existsSync(join(DATA_DIR, 'metadata.json'))
    ? JSON.parse(readFileSync(join(DATA_DIR, 'metadata.json'), 'utf-8'))
    : { source_commits: {} };

  const manifest = buildManifest(VENDOR_DIR, previousMeta.source_commits ?? {});
  const changedEntries = manifest.entries.filter(e => e.changed);
  console.log(`Found ${manifest.entries.length} libraries, ${changedEntries.length} changed`);

  for (const dir of ['components', 'chunks', 'pages']) {
    mkdirSync(join(DATA_DIR, dir), { recursive: true });
  }

  writeFileSync(join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\n--- PHASE 1: Dispatch extraction agents ---');
  console.log('For each changed library, dispatch a sonnet agent with:');
  console.log('  Prompt: src/ingest/prompts/extraction.md');
  console.log('  Manifest batch from: data/manifest.json');
  console.log('  Output to: data/components/{library}.json, data/chunks/{library}.json, data/pages/{library}.json');

  for (const entry of changedEntries) {
    for (const batch of entry.batches) {
      console.log(`  → Agent: ${batch.batch_id} (${batch.components.length} components)`);
    }
  }

  console.log('\n--- PHASE 2: Dispatch synthesis agent ---');
  console.log('Dispatch one opus agent with prompt: src/ingest/prompts/synthesis.md');
  console.log('Output: data/tags.json, data/tokens.json, data/overview.json, data/categories.json, llms.txt');

  console.log('\n--- PHASE 3: Validation ---');
  console.log('Run: npx tsx src/ingest/run-validate.ts');

  console.log('\n--- PHASE 4: Index build ---');
  console.log('Run: npx tsx src/ingest/run-build-index.ts');

  const sourceCommits: Record<string, string> = {};
  for (const entry of manifest.entries) {
    sourceCommits[entry.library] = entry.git_sha;
  }
  writeFileSync(join(DATA_DIR, 'metadata.json'), JSON.stringify({
    indexed_at: new Date().toISOString(),
    source_commits: sourceCommits,
  }, null, 2));

  console.log('\nMetadata written. Manifest ready for agent dispatch.');
}

main().catch(console.error);
