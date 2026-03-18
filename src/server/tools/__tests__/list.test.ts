import { describe, it, expect } from 'vitest';
import { handleList } from '../list.js';
import type { ListInput } from '../list.js';
import type { LoadedData } from '../../loader.js';

const stubData = {
  componentDefs: [],
  componentsByLibrary: new Map(),
  categoryMap: { categories: {} },
  overview: { libraries: [] },
  recipes: [],
  tokens: {},
} as unknown as LoadedData;

describe('list tool — ecosystem extension', () => {
  it('returns toc when called with no params', () => {
    const result = handleList(stubData, {});
    expect(result.kind).toBe('toc');
  });

  it('accepts type parameter without error', () => {
    expect(() => handleList(stubData, { type: 'hook' } as ListInput)).not.toThrow();
  });

  it('accepts library parameter without error', () => {
    expect(() => handleList(stubData, { library: 'i18n' } as ListInput)).not.toThrow();
  });
});
