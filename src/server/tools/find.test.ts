import { describe, it, expect } from 'vitest';
import { handleFind, formatFind } from './find.js';
import { buildSearchIndex } from '../index-builder.js';
import type { Entity } from '../../schemas.js';
import type { LoadedData } from '../loader.js';

function makeData(entities: Entity[]): LoadedData {
  const entityByName = new Map<string, Entity[]>();
  for (const e of entities) {
    const key = e.name.toLowerCase();
    const list = entityByName.get(key) ?? [];
    list.push(e);
    entityByName.set(key, list);
  }
  return {
    entities,
    entityByName,
    entitiesByLibrary: new Map(),
    entitiesByType: new Map(),
    index: buildSearchIndex(entities),
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
  {
    type: 'recipe', name: 'date-form', library: '',
    description: 'Form with a date picker.', keywords: ['form', 'date'],
    when_to_use: ['Build date input forms'], avoid: [],
    import_statement: '', related: [],
    title: 'Date Form',
    level: 'molecule',
    packages: [],
    components: [],
    sections: [],
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
    const result = handleFind(data, { query: 'button', type: 'component' });
    expect(result.results.every(r => r.type === 'component')).toBe(true);
  });

  it('filters by library', () => {
    const data = makeData(entities);
    const result = handleFind(data, { query: 'date', library: 'date-components' });
    expect(result.results.every(r => r.library === 'date-components')).toBe(true);
  });

  it('finds recipes through normal search', () => {
    const data = makeData(entities);
    const result = handleFind(data, { query: 'date form' });
    const recipeResult = result.results.find(r => r.type === 'recipe');
    expect(recipeResult).toBeDefined();
  });
});

describe('formatFind', () => {
  it('formats results as Name [type] (library) — description', () => {
    const data = makeData(entities);
    const result = handleFind(data, { query: 'button' });
    const text = formatFind(result);
    expect(text).toContain('Button');
    expect(text).toContain('[component]');
    expect(text).toContain('(uikit)');
    expect(text).toContain('—');
  });

  it('formats empty results', () => {
    const result = { query: 'zzxx', results: [] };
    const text = formatFind(result);
    expect(text).toContain('No results');
  });
});
