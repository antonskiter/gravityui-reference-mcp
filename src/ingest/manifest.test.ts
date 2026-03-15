import { describe, it, expect } from 'vitest';
import { buildManifest } from './manifest.js';

const VENDOR_DIR = 'vendor';

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

  it('each component has a readme_path containing README', () => {
    const result = buildManifest(VENDOR_DIR, {});

    let componentCount = 0;
    for (const entry of result.entries) {
      for (const batch of entry.batches) {
        for (const component of batch.components) {
          expect(component.readme_path).toContain('README');
          componentCount++;
        }
      }
    }
    // Should have found at least some components
    expect(componentCount).toBeGreaterThan(10);
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
});
