import { describe, it, expect } from 'vitest';
import { handleList, formatList } from './list.js';
import type { LoadedData } from '../loader.js';
import type { Entity } from '../../schemas.js';
import { buildSearchIndex } from '../index-builder.js';

const entities: Entity[] = [
  {
    type: 'component', name: 'Button', library: 'uikit',
    description: 'Button.', keywords: [], when_to_use: [], avoid: [],
    import_statement: '', related: [], props: [], examples: [],
  },
  {
    type: 'component', name: 'Select', library: 'uikit',
    description: 'Select.', keywords: [], when_to_use: [], avoid: [],
    import_statement: '', related: [], props: [], examples: [],
  },
  {
    type: 'hook', name: 'useTheme', library: 'uikit',
    description: 'Theme hook.', keywords: [], when_to_use: [], avoid: [],
    import_statement: '', related: [], parameters: [], examples: [],
  },
  {
    type: 'component', name: 'AsideHeader', library: 'navigation',
    description: 'Sidebar.', keywords: [], when_to_use: [], avoid: [],
    import_statement: '', related: [], props: [], examples: [],
  },
];

function makeData(): LoadedData {
  const entityByName = new Map<string, Entity[]>();
  const entitiesByLibrary = new Map<string, Entity[]>();
  const entitiesByType = new Map<string, Entity[]>();
  for (const e of entities) {
    entityByName.set(e.name.toLowerCase(), [...(entityByName.get(e.name.toLowerCase()) ?? []), e]);
    entitiesByLibrary.set(e.library, [...(entitiesByLibrary.get(e.library) ?? []), e]);
    entitiesByType.set(e.type, [...(entitiesByType.get(e.type) ?? []), e]);
  }
  return {
    entities, entityByName, entitiesByLibrary, entitiesByType,
    index: buildSearchIndex(entities),
  };
}

describe('handleList', () => {
  it('returns intro with no filters', () => {
    const result = handleList(makeData(), {});
    expect(result.kind).toBe('intro');
  });

  it('intro contains total and breakdown counts', () => {
    const result = handleList(makeData(), {});
    if (result.kind === 'intro') {
      expect(result.total).toBe(4);
      expect(result.byType['component']).toBe(3);
      expect(result.byType['hook']).toBe(1);
      expect(result.byLibrary['uikit']).toBe(3);
      expect(result.byLibrary['navigation']).toBe(1);
    }
  });

  it('filters by type', () => {
    const result = handleList(makeData(), { type: 'component' });
    expect(result.kind).toBe('entities');
    if (result.kind === 'entities') {
      expect(result.items.every(e => e.type === 'component')).toBe(true);
      expect(result.items).toHaveLength(3);
    }
  });

  it('filters by library', () => {
    const result = handleList(makeData(), { library: 'uikit' });
    expect(result.kind).toBe('entities');
    if (result.kind === 'entities') {
      expect(result.items.every(e => e.library === 'uikit')).toBe(true);
    }
  });

  it('filters by category using entity category field', () => {
    const entitiesWithCategory = [
      { ...entities[0], category: 'actions' } as Entity & { category: string },
      { ...entities[1], category: 'forms' } as Entity & { category: string },
    ];
    const data: LoadedData = {
      entities: entitiesWithCategory,
      entityByName: new Map([
        ['button', [entitiesWithCategory[0]]],
        ['select', [entitiesWithCategory[1]]],
      ]),
      entitiesByLibrary: new Map(),
      entitiesByType: new Map(),
      index: buildSearchIndex(entitiesWithCategory),
    };
    const result = handleList(data, { category: 'actions' });
    expect(result.kind).toBe('entities');
    if (result.kind === 'entities') {
      expect(result.items.some(e => e.name === 'Button')).toBe(true);
      expect(result.items.every(e => e.name !== 'Select')).toBe(true);
    }
  });

  it('combines type and library', () => {
    const result = handleList(makeData(), { type: 'hook', library: 'uikit' });
    expect(result.kind).toBe('entities');
    if (result.kind === 'entities') {
      expect(result.items.every(e => e.type === 'hook' && e.library === 'uikit')).toBe(true);
    }
  });
});

describe('formatList', () => {
  it('formats intro with counts and example hint', () => {
    const result = handleList(makeData(), {});
    const text = formatList(result);
    expect(text).toContain('Gravity UI');
    expect(text).toContain('entities');
    expect(text).toContain('Filter by');
    expect(text).toContain('Example:');
  });

  it('formats filtered list as Name [type] (library) — description', () => {
    const result = handleList(makeData(), { type: 'component' });
    const text = formatList(result);
    expect(text).toContain('Button');
    expect(text).toContain('[component]');
    expect(text).toContain('(uikit)');
  });
});
