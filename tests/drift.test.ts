import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { extractLibraryComponents } from '../src/ingest/extract-from-source.js';
import { loadJsonArray } from '../src/server/loader.js';
import { getLibraryConfig } from '../src/ingest/library-config.js';
import type { ComponentDef } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VENDOR_DIR = path.resolve(__dirname, '../vendor');
const DATA_DIR = path.resolve(__dirname, '../data');

const LIBRARIES = [
  'uikit', 'components', 'aikit', 'graph', 'navigation',
  'date-components', 'table', 'page-constructor', 'dashkit',
  'blog-constructor', 'chartkit',
];

describe('vendor/data drift detection', () => {
  for (const lib of LIBRARIES) {
    const config = getLibraryConfig(lib);
    if (config.moduleBased) continue;

    it(`${lib}: all vendor components are present in data/`, () => {
      const vendorComponents = extractLibraryComponents(VENDOR_DIR, lib);
      const dataComponents = loadJsonArray<ComponentDef>(DATA_DIR, 'components')
        .filter(c => c.library === lib);

      const dataNames = new Set(dataComponents.map(c => c.name));
      const missing = vendorComponents
        .map(c => c.name)
        .filter(name => !dataNames.has(name));

      if (missing.length > 0) {
        console.warn(`  ${lib}: ${missing.length} components in vendor/ but not in data/: ${missing.join(', ')}`);
      }

      // Check for removed upstream (in data but not in vendor)
      const vendorNames = new Set(vendorComponents.map(c => c.name));
      const removed = dataComponents
        .map(c => c.name)
        .filter(name => !vendorNames.has(name));

      if (removed.length > 0) {
        console.warn(`  ${lib}: ${removed.length} components in data/ but not in vendor/ (possibly removed upstream): ${removed.join(', ')}`);
      }

      // Allow a small tolerance — some vendor exports may not be real components
      // (e.g. utility functions starting with uppercase)
      const missingRatio = missing.length / Math.max(vendorComponents.length, 1);
      expect(missingRatio).toBeLessThan(0.15); // less than 15% drift
    });
  }

  it('no libraries with zero data coverage', () => {
    const dataComponents = loadJsonArray<ComponentDef>(DATA_DIR, 'components');
    const librariesInData = new Set(dataComponents.map(c => c.library));

    for (const lib of LIBRARIES) {
      const config = getLibraryConfig(lib);
      if (config.moduleBased) continue;

      const vendorComponents = extractLibraryComponents(VENDOR_DIR, lib);
      if (vendorComponents.length > 0) {
        expect(librariesInData.has(lib), `${lib} has vendor components but no data coverage`).toBe(true);
      }
    }
  });
});
