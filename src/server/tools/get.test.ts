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
    { name: 'loading', type: 'boolean', required: false, description: 'Loading state' },
    { name: 'disabled', type: 'boolean', required: false, description: 'Disabled state' },
    { name: 'onClick', type: '() => void', required: false, description: 'Click handler' },
    { name: 'extra', type: 'string', required: false, description: 'Extra prop' },
  ],
  examples: ['<Button size="m">Click</Button>'],
};

const buttonNav: Entity = {
  type: 'component', name: 'Button', library: 'navigation',
  description: 'Navigation button.', keywords: ['button'],
  when_to_use: [], avoid: [],
  import_statement: "import {Button} from '@gravity-ui/navigation';",
  related: [],
  props: [],
  examples: [],
};

const hook: Entity = {
  type: 'hook', name: 'useTheme', library: 'uikit',
  description: 'Access theme.', keywords: ['theme'],
  when_to_use: [], avoid: [],
  import_statement: "import {useTheme} from '@gravity-ui/uikit';",
  related: [],
  signature: 'useTheme(): Theme',
  return_type: 'Theme',
  parameters: [],
  examples: ['const theme = useTheme();'],
};

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

describe('handleGet', () => {
  it('finds entity by exact name', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'Button' });
    expect(result.type).toBe('found');
  });

  it('finds entity case-insensitive', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'button' });
    expect(result.type).toBe('found');
  });

  it('returns all matches when multiple libraries share a name', () => {
    const data = makeData([button, buttonNav]);
    const result = handleGet(data, { name: 'Button' });
    expect(result.type).toBe('found');
    if (result.type === 'found') {
      expect(result.entities).toHaveLength(2);
    }
  });

  it('filters by library', () => {
    const data = makeData([button, buttonNav]);
    const result = handleGet(data, { name: 'Button', library: 'uikit' });
    expect(result.type).toBe('found');
    if (result.type === 'found') {
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].library).toBe('uikit');
    }
  });

  it('filters by type', () => {
    const data = makeData([button, hook]);
    const result = handleGet(data, { name: 'useTheme', type: 'hook' });
    expect(result.type).toBe('found');
    if (result.type === 'found') {
      expect(result.entities[0].type).toBe('hook');
    }
  });

  it('returns not_found with suggestions for unknown', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'Buton' });
    expect(result.type).toBe('not_found');
  });

  it('returns not_found when type filter eliminates all matches', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'Button', type: 'hook' });
    expect(result.type).toBe('not_found');
  });
});

describe('formatGet', () => {
  it('formats component with all props, when_to_use, and avoid', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'Button' });
    const text = formatGet(result);
    expect(text).toContain('Button');
    expect(text).toContain('import');
    expect(text).toContain('When to use');
    expect(text).toContain('Avoid');
    expect(text).toContain('extra');
  });

  it('formats multiple matches separated by ---', () => {
    const data = makeData([button, buttonNav]);
    const result = handleGet(data, { name: 'Button' });
    const text = formatGet(result);
    expect(text).toContain('---');
    expect(text).toContain('uikit');
    expect(text).toContain('navigation');
  });

  it('formats not_found with suggestions', () => {
    const data = makeData([button]);
    const result = handleGet(data, { name: 'Buton' });
    const text = formatGet(result);
    expect(text).toContain('not found');
  });
});
