import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractLibraryComponents } from './extract-from-source.js';
import { generatePageFromComponent, generateChunksFromComponent } from './generate-data.js';
import type { ComponentDef } from '../types.js';

// Resolve paths relative to this script file, not process.cwd()
// __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// src/ingest/ -> src/ -> worktree root
const WORKTREE_ROOT = join(__dirname, '..', '..');
// IMPORTANT: vendor/ is at the MAIN repo root, not the worktree
// because git submodules share worktree content from the main repo
const VENDOR_DIR = join(WORKTREE_ROOT, '..', '..', 'vendor');
const DATA_DIR = join(WORKTREE_ROOT, 'data');

const LIBRARIES = [
  'uikit', 'components', 'aikit', 'graph', 'navigation',
  'date-components', 'table', 'page-constructor', 'dashkit',
  'dialog-fields', 'dynamic-forms', 'blog-constructor',
  'data-source', 'timeline', 'chartkit', 'yagr',
];

function loadExisting(dirPath: string, lib: string): ComponentDef[] {
  try {
    // Try per-library file first
    const libFile = join(dirPath, `${lib}.json`);
    if (existsSync(libFile)) {
      return JSON.parse(readFileSync(libFile, 'utf8'));
    }
    // Try split files (uikit-1.json, uikit-2.json)
    const files = readdirSync(dirPath).filter(f => f.startsWith(lib) && f.endsWith('.json'));
    const items: ComponentDef[] = [];
    for (const f of files) {
      items.push(...JSON.parse(readFileSync(join(dirPath, f), 'utf8')));
    }
    return items;
  } catch {
    return [];
  }
}

function mergeComponents(existing: ComponentDef[], extracted: ComponentDef[]): ComponentDef[] {
  const byName = new Map<string, ComponentDef>();

  // Existing data first (typically richer — LLM-generated)
  for (const comp of existing) {
    byName.set(comp.name, comp);
  }

  // Add newly extracted components (only if not already present)
  for (const comp of extracted) {
    if (!byName.has(comp.name)) {
      byName.set(comp.name, comp);
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function main() {
  console.log('Source-based component extraction');
  console.log(`Vendor dir: ${VENDOR_DIR}`);
  console.log(`Data dir: ${DATA_DIR}`);

  for (const dir of ['components', 'pages', 'chunks']) {
    mkdirSync(join(DATA_DIR, dir), { recursive: true });
  }

  let totalComponents = 0;
  let totalNew = 0;

  for (const lib of LIBRARIES) {
    const extracted = extractLibraryComponents(VENDOR_DIR, lib);
    if (extracted.length === 0) {
      console.log(`  skip ${lib} (no components found)`);
      continue;
    }

    const existingComponents = loadExisting(join(DATA_DIR, 'components'), lib);
    const merged = mergeComponents(existingComponents, extracted);

    const pages = merged.map(c => generatePageFromComponent(c));
    const chunks = merged.flatMap(c => generateChunksFromComponent(c));

    writeFileSync(
      join(DATA_DIR, 'components', `${lib}.json`),
      JSON.stringify(merged, null, 2)
    );
    writeFileSync(
      join(DATA_DIR, 'pages', `${lib}.json`),
      JSON.stringify(pages, null, 2)
    );
    writeFileSync(
      join(DATA_DIR, 'chunks', `${lib}.json`),
      JSON.stringify(chunks, null, 2)
    );

    const newCount = merged.length - existingComponents.length;
    totalComponents += merged.length;
    totalNew += Math.max(0, newCount);
    console.log(`  ${lib}: ${merged.length} components (${newCount > 0 ? '+' + newCount + ' new' : 'unchanged'})`);
  }

  console.log(`\nTotal: ${totalComponents} components, ${totalNew} newly discovered`);
}

main();
