import { describe, it, expect } from 'vitest';
import { handleGet, formatGet } from './get.js';
import type { LoadedData } from '../loader.js';
import type { Entity } from '../../schemas.js';
import { buildSearchIndex } from '../index-builder.js';

const button: Entity = {
  type: 'component', name: 'Button', library: 'uikit',
  description: 'A versatile button.', keywords: ['button'],
  when_to_use: ['Trigger actions'], avoid: ['For links use Link'],
  import_statement: "import {Button} from '@gravity-ui/uikit';",
  related: ['ButtonGroup'],
  props: [
    { name: 'size', type: "'s' | 'm' | 'l'", required: false, default: "'m'", description: 'Size' },
    { name: 'view', type: "'normal' | 'action'", required: false, description: 'Visual style' },
  ],
  examples: ['<Button size="m">Click</Button>'],
};

function makeData(entities: Entity[]): LoadedData {
  const entityByName = new Map<string, Entity[]>();
  for (const e of entities) {
    const list = entityByName.get(e.name) ?? [];
    list.push(e);
    entityByName.set(e.name, list);
  }
  return {
    entities, entityByName,
    entitiesByLibrary: new Map(),
    entitiesByType: new Map(),
    index: buildSearchIndex(entities, []),
    overview: { system: { description: 'Gravity UI' }, libraries: [], categories: {}, component_categories: {} },
    recipes: [], recipeById: new Map(),
  };
}

describe('handleGet', () => {
  it('finds entity by exact name', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'Button' });
    expect(result.type).toBe('entity');
  });

  it('finds entity case-insensitive', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'button' });
    expect(result.type).toBe('entity');
  });

  it('returns overview for "overview"', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'overview' });
    expect(result.type).toBe('overview');
  });

  it('returns recipe by id', () => {
    const data = makeData([]);
    data.recipeById.set('date-form', {
      id: 'date-form', title: 'Date Form', description: 'Form with dates.',
      level: 'molecule', use_cases: [], packages: [], tags: [], sections: [],
    });
    data.recipes.push(data.recipeById.get('date-form')!);
    const result = handleGet(data, { name: 'date-form' });
    expect(result.type).toBe('recipe');
  });

  it('returns not_found with suggestions for unknown', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'Buton' });
    expect(result.type).toBe('not_found');
  });
});

describe('formatGet', () => {
  it('formats component in compact mode', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'Button' });
    const text = formatGet(result, 'compact');
    expect(text).toContain('Button');
    expect(text).toContain('import');
  });

  it('formats component in full mode', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'Button' });
    const text = formatGet(result, 'full');
    expect(text).toContain('When to use');
    expect(text).toContain('Avoid');
  });
});
