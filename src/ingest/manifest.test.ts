import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { buildManifest } from './manifest.js';

// Resolve vendor from the main repo root (worktree submodules may be uninitialized).
// __dirname is not available in ESM; use import.meta.url instead.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VENDOR_DIR = path.resolve(__dirname, '../../../../vendor');

describe('buildManifest', () => {
  it('discovers vendor submodules and builds batches', () => {
    const result = buildManifest(VENDOR_DIR, {});

    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.timestamp).toBeTruthy();

    const uikitEntry = result.entries.find(e => e.library === 'uikit');
    expect(uikitEntry).toBeDefined();
    expect(uikitEntry!.batches.length).toBeGreaterThan(1);

    // Each batch should have ~10 components (last batch may have fewer)
    const firstBatch = uikitEntry!.batches[0];
    expect(firstBatch.components.length).toBe(10);
  });

  it('marks libraries as changed when SHA differs from previousShas', () => {
    const previousShas = { uikit: 'oldsha123456' };
    const result = buildManifest(VENDOR_DIR, previousShas);

    const uikitEntry = result.entries.find(e => e.library === 'uikit');
    expect(uikitEntry).toBeDefined();
    expect(uikitEntry!.changed).toBe(true);
  });

  it('marks libraries as unchanged when SHA matches previousShas', () => {
    // First run to get actual SHA
    const firstRun = buildManifest(VENDOR_DIR, {});
    const uikitEntry = firstRun.entries.find(e => e.library === 'uikit');
    expect(uikitEntry).toBeDefined();

    const previousShas = { uikit: uikitEntry!.git_sha };
    const result = buildManifest(VENDOR_DIR, previousShas);

    const uikitEntry2 = result.entries.find(e => e.library === 'uikit');
    expect(uikitEntry2).toBeDefined();
    expect(uikitEntry2!.changed).toBe(false);
  });

  it('all components start with uppercase', () => {
    const result = buildManifest(VENDOR_DIR, {});

    for (const entry of result.entries) {
      for (const batch of entry.batches) {
        for (const component of batch.components) {
          expect(component.name[0]).toMatch(/[A-Z]/);
        }
      }
    }
  });

  it('each component has source_paths and readme_path is optional', () => {
    const result = buildManifest(VENDOR_DIR, {});

    let componentCount = 0;
    let withReadme = 0;
    for (const entry of result.entries) {
      for (const batch of entry.batches) {
        for (const component of batch.components) {
          // source_paths required for every component (except flat-file mode which has 1 path)
          expect(component.source_paths.length).toBeGreaterThan(0);
          // readme_path is optional — when present it must contain README
          if (component.readme_path !== undefined) {
            expect(component.readme_path).toContain('README');
            withReadme++;
          }
          componentCount++;
        }
      }
    }
    // Should have found significantly more components than the old README-gated approach
    expect(componentCount).toBeGreaterThan(10);
    // At least some components have a readme_path
    expect(withReadme).toBeGreaterThan(0);
  });

  it('entries are sorted by library name', () => {
    const result = buildManifest(VENDOR_DIR, {});

    const names = result.entries.map(e => e.library);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('batch IDs are unique per library', () => {
    const result = buildManifest(VENDOR_DIR, {});

    for (const entry of result.entries) {
      const batchIds = entry.batches.map(b => b.batch_id);
      const uniqueIds = new Set(batchIds);
      expect(uniqueIds.size).toBe(batchIds.length);
    }
  });

  it('discovers layout components without README in uikit', () => {
    const result = buildManifest(VENDOR_DIR, {});

    const uikitEntry = result.entries.find(e => e.library === 'uikit');
    expect(uikitEntry).toBeDefined();

    const allComponents = uikitEntry!.batches.flatMap(b => b.components);
    const names = allComponents.map(c => c.name);

    // Layout components exist in src/components/layout/ without README.md
    for (const expected of ['Flex', 'Box', 'Row', 'Col', 'Container']) {
      expect(names).toContain(expected);
    }

    // Verify they have no readme_path (layout components don't have README.md)
    for (const expected of ['Flex', 'Box', 'Row', 'Col', 'Container']) {
      const comp = allComponents.find(c => c.name === expected);
      expect(comp).toBeDefined();
      expect(comp!.readme_path).toBeUndefined();
    }
  });

  it('discovers flat file components in graph library', () => {
    const result = buildManifest(VENDOR_DIR, {});

    const graphEntry = result.entries.find(e => e.library === 'graph');
    expect(graphEntry).toBeDefined();

    const allComponents = graphEntry!.batches.flatMap(b => b.components);
    const names = allComponents.map(c => c.name);

    expect(names).toContain('GraphCanvas');
  });
});
