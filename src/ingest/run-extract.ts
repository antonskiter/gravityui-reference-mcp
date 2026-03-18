// src/ingest/run-extract.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { buildManifest } from './manifest.js';

const VENDOR_DIR = 'vendor';
const DATA_DIR = 'data';
const EXCLUDED_LIBRARIES = ['landing'];

async function main() {
  const previousMeta = existsSync(join(DATA_DIR, 'metadata.json'))
    ? JSON.parse(readFileSync(join(DATA_DIR, 'metadata.json'), 'utf-8'))
    : { source_commits: {} };

  const manifest = buildManifest(VENDOR_DIR, previousMeta.source_commits ?? {});
  const entries = manifest.entries.filter(e => !EXCLUDED_LIBRARIES.includes(e.library));
  const changed = entries.filter(e => e.changed);

  mkdirSync(join(DATA_DIR, 'entities'), { recursive: true });

  console.log(`Libraries: ${entries.length} total, ${changed.length} changed\n`);

  console.log('For each changed library, dispatch a Sonnet agent with:');
  console.log('  Prompt: src/ingest/prompts/extraction.md');
  console.log('  Task: read vendor/{library}/ source files, output entities JSON');
  console.log('  Output: data/entities/{library}.json\n');

  for (const entry of changed) {
    const compCount = entry.batches.reduce((sum, b) => sum + b.components.length, 0);
    console.log(`  → ${entry.library}: ${compCount} components discovered`);
  }

  console.log('\nUnchanged (skip):');
  for (const entry of entries.filter(e => !e.changed)) {
    console.log(`  ✓ ${entry.library}`);
  }

  // Write metadata with current SHAs
  const sourceCommits: Record<string, string> = {};
  for (const entry of entries) {
    sourceCommits[entry.library] = entry.git_sha;
  }
  writeFileSync(join(DATA_DIR, 'metadata.json'), JSON.stringify({
    indexed_at: new Date().toISOString(),
    source_commits: sourceCommits,
  }, null, 2));

  console.log('\nMetadata written. Dispatch agents for changed libraries.');
}

main().catch(console.error);
