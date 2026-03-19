import { describe, it, expect } from 'vitest';
import { handleList, formatList } from './list.js';
import type { LoadedData } from '../loader.js';
import type { Entity, Overview } from '../../schemas.js';
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

const overview: Overview = {
  system: { description: 'Gravity UI' },
  libraries: [
    { id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core', component_count: 70, depends_on: [], is_peer_dependency_of: [] },
  ],
  categories: { actions: 'Action components', forms: 'Form components' },
  component_categories: { Button: 'actions', Select: 'forms' },
};

function makeData(): LoadedData {
  const entityByName = new Map<string, Entity[]>();
  const entitiesByLibrary = new Map<string, Entity[]>();
  const entitiesByType = new Map<string, Entity[]>();
  for (const e of entities) {
    entityByName.set(e.name, [...(entityByName.get(e.name) ?? []), e]);
    entitiesByLibrary.set(e.library, [...(entitiesByLibrary.get(e.library) ?? []), e]);
    entitiesByType.set(e.type, [...(entitiesByType.get(e.type) ?? []), e]);
  }
  return {
    entities, entityByName, entitiesByLibrary, entitiesByType,
    index: buildSearchIndex(entities, []),
    overview, recipes: [], recipeById: new Map(),
  };
}

describe('handleList', () => {
  it('returns summary with no filters', () => {
    const result = handleList(makeData(), {});
    expect(result.kind).toBe('summary');
  });

  it('filters by type', () => {
    const result = handleList(makeData(), { type: 'component' });
    expect(result.kind).toBe('entities');
    if (result.kind === 'entities') {
      expect(result.items.every(e => e.type === 'component')).toBe(true);
    }
  });

  it('filters by library', () => {
    const result = handleList(makeData(), { library: 'uikit' });
    expect(result.kind).toBe('entities');
    if (result.kind === 'entities') {
      expect(result.items.every(e => e.library === 'uikit')).toBe(true);
    }
  });

  it('filters by category', () => {
    const result = handleList(makeData(), { category: 'actions' });
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
  it('formats summary', () => {
    const result = handleList(makeData(), {});
    const text = formatList(result);
    expect(text).toContain('entities');
  });

  it('formats filtered list', () => {
    const result = handleList(makeData(), { type: 'component' });
    const text = formatList(result);
    expect(text).toContain('Button');
  });
});
