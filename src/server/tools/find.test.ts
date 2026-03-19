import { describe, it, expect } from 'vitest';
import { handleFind, formatFind } from './find.js';
import { buildSearchIndex } from '../index-builder.js';
import type { Entity, RecipeDef } from '../../schemas.js';
import type { LoadedData } from '../loader.js';

function makeData(entities: Entity[], recipes: RecipeDef[] = []): LoadedData {
  const index = buildSearchIndex(entities, recipes);
  return {
    entities, index, recipes,
    entityByName: new Map(), entitiesByLibrary: new Map(),
    entitiesByType: new Map(),
    overview: { system: { description: '' }, libraries: [], categories: {}, component_categories: {} },
    recipeById: new Map(recipes.map(r => [r.id, r])),
  };
}

const entities: Entity[] = [
  {
    type: 'component', name: 'Button', library: 'uikit',
    description: 'A button for actions.', keywords: ['button', 'action'],
    when_to_use: ['Trigger actions'], avoid: [],
    import_statement: "import {Button} from '@gravity-ui/uikit';",
    related: [], props: [], examples: [],
  },
  {
    type: 'component', name: 'DatePicker', library: 'date-components',
    description: 'Pick a date.', keywords: ['date', 'calendar'],
    when_to_use: ['Select dates'], avoid: [],
    import_statement: '', related: [], props: [], examples: [],
  },
];

describe('handleFind', () => {
  it('returns results for matching query', () => {
    const data = makeData(entities);
    const result = handleFind(data, { query: 'button' });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].name).toBe('Button');
  });

  it('returns empty for no match', () => {
    const data = makeData(entities);
    const result = handleFind(data, { query: 'zzxxqqww' });
    expect(result.results).toHaveLength(0);
  });

  it('filters by type', () => {
    const data = makeData(entities);
    const result = handleFind(data, { query: 'button', type: 'hook' });
    expect(result.results.every(r => r.type === 'hook' || r.type === 'recipe')).toBe(true);
  });
});

describe('formatFind', () => {
  it('formats results as plain text', () => {
    const data = makeData(entities);
    const result = handleFind(data, { query: 'button' });
    const text = formatFind(result);
    expect(text).toContain('Button');
    expect(text).toContain('uikit');
  });

  it('formats empty results', () => {
    const result = { query: 'zzxx', results: [] };
    const text = formatFind(result);
    expect(text).toContain('No results');
  });
});
