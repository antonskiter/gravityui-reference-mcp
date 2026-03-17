import { describe, it, expect } from 'vitest';
import { handleGet, formatGet } from '../get.js';

function makeComponent(name: string, library: string) {
  return {
    name, library,
    import_path: `@gravity-ui/${library}`,
    import_statement: `import {${name}} from '@gravity-ui/${library}';`,
    props: [{ name: 'size', type: 'string', required: false }],
    examples: ['<' + name + ' />'], description: `${name} component`, source_file: '',
  };
}

function makeRecipe(id: string, overrides: Partial<any> = {}) {
  return {
    id, title: overrides.title ?? id,
    description: overrides.description ?? `Recipe ${id}`,
    level: overrides.level ?? 'molecule',
    use_cases: [], packages: [], tags: [], sections: [],
    ...overrides,
  };
}

function buildTestData(options: {
  components?: any[], recipes?: any[], tokens?: any, overview?: any,
} = {}) {
  const components = options.components ?? [];
  const recipes = options.recipes ?? [];
  const tokens = options.tokens ?? { spacing: { '1': '4px' }, breakpoints: { s: 576 }, sizes: { m: '28px' } };

  const componentByName = new Map<string, any[]>();
  for (const c of components) {
    const list = componentByName.get(c.name) || [];
    list.push(c);
    componentByName.set(c.name, list);
  }

  const overview = options.overview ?? {
    system: { description: 'Gravity UI', theming: 'dark/light', spacing: '4px grid', typography: 'scales', corner_radius: '4px', branding: 'Gravity' },
    libraries: [{ id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core components', component_count: 50, depends_on: [], is_peer_dependency_of: ['components'] }],
  };

  return {
    componentDefs: components,
    componentByName,
    componentsByLibrary: new Map<string, any[]>(),
    recipes,
    recipeById: new Map(recipes.map((r: any) => [r.id, r])),
    tokens,
    overview,
    pageById: new Map(),
    tagsByPageId: new Map(),
    chunkById: new Map(),
    index: { search: () => [] } as any,
    categoryMap: { categories: {}, components: {} },
  } as any;
}

describe('handleGet — routing priority', () => {
  // Priority 1: token topics
  it('routes "spacing" to tokens', () => {
    const result = handleGet(buildTestData(), { name: 'spacing' });
    expect(result.type).toBe('tokens');
    expect(result.data.spacing).toBeDefined();
  });

  it('routes "breakpoints" to tokens', () => {
    const result = handleGet(buildTestData(), { name: 'breakpoints' });
    expect(result.type).toBe('tokens');
  });

  it('routes "colors" to tokens', () => {
    const data = buildTestData({ tokens: { spacing: {}, breakpoints: {}, sizes: {}, colors: { primary: '#000' } } });
    const result = handleGet(data, { name: 'colors' });
    expect(result.type).toBe('tokens');
  });

  it('routes "typography" to tokens', () => {
    const data = buildTestData({ tokens: { spacing: {}, breakpoints: {}, sizes: {}, typography: { body: '14px' } } });
    const result = handleGet(data, { name: 'typography' });
    expect(result.type).toBe('tokens');
  });

  it('routes "sizes" to tokens', () => {
    const result = handleGet(buildTestData(), { name: 'sizes' });
    expect(result.type).toBe('tokens');
  });

  // Priority 2: overview
  it('routes "overview" to overview', () => {
    const result = handleGet(buildTestData(), { name: 'overview' });
    expect(result.type).toBe('overview');
    expect(result.data.system).toBeDefined();
  });

  // Priority 3: component by PascalCase name
  it('routes PascalCase name to component', () => {
    const data = buildTestData({ components: [makeComponent('Button', 'uikit')] });
    const result = handleGet(data, { name: 'Button' });
    expect(result.type).toBe('component');
    expect(result.data.name).toBe('Button');
  });

  it('prefers uikit when component exists in multiple libraries', () => {
    const data = buildTestData({
      components: [
        makeComponent('Label', 'components'),
        makeComponent('Label', 'uikit'),
      ],
    });
    const result = handleGet(data, { name: 'Label' });
    expect(result.type).toBe('component');
    expect(result.data.library).toBe('uikit');
    expect(result.seeAlso).toBeDefined();
    expect(result.seeAlso!.some((s: string) => s.includes('components'))).toBe(true);
  });

  // Priority 4: recipe by kebab-case ID
  it('routes kebab-case ID to recipe', () => {
    const data = buildTestData({ recipes: [makeRecipe('confirmation-dialog')] });
    const result = handleGet(data, { name: 'confirmation-dialog' });
    expect(result.type).toBe('recipe');
    expect(result.data.id).toBe('confirmation-dialog');
  });

  it('matches recipe by prefix', () => {
    const data = buildTestData({ recipes: [makeRecipe('data-table-with-filters')] });
    const result = handleGet(data, { name: 'data-table' });
    expect(result.type).toBe('recipe');
    expect(result.data.id).toBe('data-table-with-filters');
  });

  it('does not prefix-match when multiple recipes match', () => {
    const data = buildTestData({
      recipes: [makeRecipe('data-table-basic'), makeRecipe('data-table-advanced')],
    });
    const result = handleGet(data, { name: 'data-table' });
    // Should NOT match via prefix since ambiguous — falls through to fuzzy or not_found
    expect(result.type).not.toBe('recipe');
  });

  // Priority 5: library ID
  it('routes library ID to library', () => {
    const result = handleGet(buildTestData(), { name: 'uikit' });
    expect(result.type).toBe('library');
    expect(result.data.id).toBe('uikit');
  });

  // Priority 6: not found
  it('returns not_found with suggestions for unknown name', () => {
    const data = buildTestData({ components: [makeComponent('Button', 'uikit')] });
    const result = handleGet(data, { name: 'Buttn' });
    expect(result.type).toBe('not_found');
  });

  // Case insensitivity
  it('matches component name case-insensitively', () => {
    const data = buildTestData({ components: [makeComponent('Button', 'uikit')] });
    const result = handleGet(data, { name: 'button' });
    expect(result.type).toBe('component');
  });
});

describe('formatGet', () => {
  it('formats component output with seeAlso', () => {
    const output = {
      type: 'component' as const,
      data: makeComponent('Button', 'uikit'),
      seeAlso: ['Button (components)'],
    };
    const text = formatGet(output);
    expect(text).toContain('Button');
    expect(text).toContain('Also available in');
    expect(text).toContain('Button (components)');
  });

  it('formats component output without seeAlso', () => {
    const output = {
      type: 'component' as const,
      data: makeComponent('Button', 'uikit'),
    };
    const text = formatGet(output);
    expect(text).toContain('Button');
    expect(text).not.toContain('Also available in');
  });

  it('formats tokens output', () => {
    const output = {
      type: 'tokens' as const,
      data: { spacing: { '1': '4px', '2': '8px' } },
    };
    const text = formatGet(output);
    expect(text).toContain('Spacing');
    expect(text).toContain('4px');
  });

  it('formats not_found output with suggestions', () => {
    const output = {
      type: 'not_found' as const,
      data: { name: 'Buttn', suggestions: ['Button'] },
    };
    const text = formatGet(output);
    expect(text).toContain("'Buttn' not found");
    expect(text).toContain('Similar: Button');
    expect(text).toContain("find('Buttn')");
  });

  it('formats not_found output without suggestions', () => {
    const output = {
      type: 'not_found' as const,
      data: { name: 'xyz123' },
    };
    const text = formatGet(output);
    expect(text).toContain("'xyz123' not found");
    expect(text).not.toContain('Similar');
  });

  it('formats recipe output as stub', () => {
    const output = {
      type: 'recipe' as const,
      data: { id: 'confirm-dialog', title: 'Confirmation Dialog', description: 'A dialog pattern' },
    };
    const text = formatGet(output);
    expect(text).toContain('recipe');
    expect(text).toContain('Confirmation Dialog');
  });

  it('formats library output as stub', () => {
    const output = {
      type: 'library' as const,
      data: { id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core components' },
    };
    const text = formatGet(output);
    expect(text).toContain('library');
    expect(text).toContain('uikit');
  });

  it('formats overview output as stub', () => {
    const output = {
      type: 'overview' as const,
      data: { system: { description: 'Gravity UI design system' } },
    };
    const text = formatGet(output);
    expect(text).toContain('overview');
    expect(text).toContain('Gravity UI');
  });
});
