import { describe, it, expect } from 'vitest';
import { handleGet, formatGet, formatRecipe, formatLibrary, formatOverview } from '../get.js';

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

  it('formats recipe output via formatGet compact', () => {
    const output = {
      type: 'recipe' as const,
      data: makeRecipe('confirm-dialog', {
        title: 'Confirmation Dialog',
        description: 'A dialog pattern',
        level: 'molecule',
        packages: ['@gravity-ui/uikit'],
        sections: [
          { type: 'decision', when: 'destructive action', not_for: 'simple alerts' },
          { type: 'components', items: [{ name: 'Dialog', library: 'uikit', usage: 'required', role: 'modal container' }] },
        ],
      }),
    };
    const text = formatGet(output);
    expect(text).toContain('Confirmation Dialog (molecule)');
    expect(text).toContain('When: destructive action');
    expect(text).toContain('Dialog (uikit) [required]');
  });

  it('formats library output via formatGet', () => {
    const output = {
      type: 'library' as const,
      data: { id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core components', component_count: 50, depends_on: [], is_peer_dependency_of: ['components'] },
    };
    const text = formatGet(output);
    expect(text).toContain('uikit (@gravity-ui/uikit)');
    expect(text).toContain('50 components');
    expect(text).toContain('Used by: components');
  });

  it('formats overview output via formatGet', () => {
    const output = {
      type: 'overview' as const,
      data: {
        system: { description: 'Gravity UI', theming: 'dark/light', spacing: '4px grid', typography: 'scales', corner_radius: '4px', branding: 'Gravity' },
        libraries: [
          { id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core', component_count: 50, depends_on: [], is_peer_dependency_of: [] },
          { id: 'components', package: '@gravity-ui/components', purpose: 'Extra', component_count: 20, depends_on: ['uikit'], is_peer_dependency_of: [] },
        ],
      },
    };
    const text = formatGet(output);
    expect(text).toContain('Gravity UI Design System');
    expect(text).toContain('Theming: dark/light');
    expect(text).toContain('2 libraries: uikit, components');
  });
});

describe('formatRecipe', () => {
  const fullRecipe = makeRecipe('confirmation-dialog', {
    title: 'Confirmation Dialog',
    description: 'A confirmation dialog pattern for destructive actions',
    level: 'molecule',
    packages: ['@gravity-ui/uikit'],
    sections: [
      { type: 'decision', when: 'User triggers a destructive action', not_for: 'Simple informational alerts', matrix: [
        { situation: 'Delete item', component: 'Dialog', why: 'Needs confirmation' },
        { situation: 'Info notice', component: 'Alert', why: 'No action needed' },
      ] },
      { type: 'components', items: [
        { name: 'Dialog', library: 'uikit', usage: 'required', role: 'modal container' },
        { name: 'Button', library: 'uikit', usage: 'required', role: 'confirm/cancel actions' },
        { name: 'Icon', library: 'uikit', usage: 'optional', role: 'visual indicator' },
      ] },
      { type: 'structure', tree: ['Dialog', '  Dialog.Header', '  Dialog.Body', '  Dialog.Footer'], flow: ['user clicks delete', 'dialog opens', 'user confirms or cancels'] },
      { type: 'example', title: 'Basic confirmation', code: '<Dialog open={open}>\n  <Dialog.Body>Are you sure?</Dialog.Body>\n</Dialog>' },
      { type: 'example', title: 'With icon', code: '<Dialog open={open}>\n  <Icon data={TrashBin} />\n</Dialog>' },
      { type: 'avoid', items: ['Custom modal divs — Dialog handles focus trapping', 'window.confirm() — not styleable'] },
      { type: 'related', items: [{ id: 'user-feedback', note: 'Show toast after confirmation completes' }] },
    ],
  });

  it('compact: includes title, level, description', () => {
    const text = formatRecipe(fullRecipe, 'compact');
    expect(text).toContain('Confirmation Dialog (molecule)');
    expect(text).toContain('A confirmation dialog pattern for destructive actions');
  });

  it('compact: includes decision when/not_for', () => {
    const text = formatRecipe(fullRecipe, 'compact');
    expect(text).toContain('When: User triggers a destructive action');
    expect(text).toContain('Not for: Simple informational alerts');
  });

  it('compact: includes components list', () => {
    const text = formatRecipe(fullRecipe, 'compact');
    expect(text).toContain('Components:');
    expect(text).toContain('Dialog (uikit) [required] — modal container');
    expect(text).toContain('Button (uikit) [required] — confirm/cancel actions');
    expect(text).toContain('Icon (uikit) [optional] — visual indicator');
  });

  it('compact: includes install line', () => {
    const text = formatRecipe(fullRecipe, 'compact');
    expect(text).toContain('Install: @gravity-ui/uikit');
  });

  it('compact: does NOT include structure, matrix, examples, avoid, related', () => {
    const text = formatRecipe(fullRecipe, 'compact');
    expect(text).not.toContain('Structure:');
    expect(text).not.toContain('Flow:');
    expect(text).not.toContain('Decision matrix:');
    expect(text).not.toContain('Example:');
    expect(text).not.toContain('Avoid:');
    expect(text).not.toContain('Related:');
  });

  it('full: includes structure tree', () => {
    const text = formatRecipe(fullRecipe, 'full');
    expect(text).toContain('Structure:');
    expect(text).toContain('Dialog');
    expect(text).toContain('Dialog.Header');
  });

  it('full: includes structure flow', () => {
    const text = formatRecipe(fullRecipe, 'full');
    expect(text).toContain('Flow:');
    expect(text).toContain('user clicks delete');
  });

  it('full: includes decision matrix', () => {
    const text = formatRecipe(fullRecipe, 'full');
    expect(text).toContain('Decision matrix:');
    expect(text).toContain('Delete item -> Dialog — Needs confirmation');
    expect(text).toContain('Info notice -> Alert — No action needed');
  });

  it('full: includes all examples with code fences', () => {
    const text = formatRecipe(fullRecipe, 'full');
    expect(text).toContain('Example: Basic confirmation');
    expect(text).toContain('```tsx');
    expect(text).toContain('<Dialog open={open}>');
    expect(text).toContain('Example: With icon');
    expect(text).toContain('TrashBin');
  });

  it('full: includes avoid items', () => {
    const text = formatRecipe(fullRecipe, 'full');
    expect(text).toContain('Avoid:');
    expect(text).toContain('Custom modal divs — Dialog handles focus trapping');
    expect(text).toContain('window.confirm() — not styleable');
  });

  it('full: includes related items', () => {
    const text = formatRecipe(fullRecipe, 'full');
    expect(text).toContain('Related:');
    expect(text).toContain('user-feedback — Show toast after confirmation completes');
  });

  it('handles recipe with no sections gracefully', () => {
    const minimal = makeRecipe('minimal', {
      title: 'Minimal',
      description: 'A minimal recipe',
      level: 'foundation',
      packages: [],
    });
    const text = formatRecipe(minimal, 'full');
    expect(text).toContain('Minimal (foundation)');
    expect(text).toContain('A minimal recipe');
    expect(text).not.toContain('Components:');
    expect(text).not.toContain('Install:');
  });

  it('defaults to compact when detail is omitted', () => {
    const text = formatRecipe(fullRecipe);
    expect(text).not.toContain('Example:');
    expect(text).toContain('When:');
  });
});

describe('formatLibrary', () => {
  it('formats library with dependencies', () => {
    const lib = {
      id: 'components',
      package: '@gravity-ui/components',
      purpose: 'Extended component set',
      component_count: 30,
      depends_on: ['uikit'],
      is_peer_dependency_of: ['navigation'],
    };
    const text = formatLibrary(lib);
    expect(text).toContain('components (@gravity-ui/components)');
    expect(text).toContain('Extended component set');
    expect(text).toContain('30 components');
    expect(text).toContain('Depends on: uikit');
    expect(text).toContain('Used by: navigation');
  });

  it('formats library with no dependencies as "none"', () => {
    const lib = {
      id: 'uikit',
      package: '@gravity-ui/uikit',
      purpose: 'Core components',
      component_count: 50,
      depends_on: [],
      is_peer_dependency_of: [],
    };
    const text = formatLibrary(lib);
    expect(text).toContain('Depends on: none');
    expect(text).toContain('Used by: none');
  });

  it('formats library with multiple dependencies', () => {
    const lib = {
      id: 'page-constructor',
      package: '@gravity-ui/page-constructor',
      purpose: 'Page builder',
      component_count: 15,
      depends_on: ['uikit', 'components'],
      is_peer_dependency_of: ['blog-constructor'],
    };
    const text = formatLibrary(lib);
    expect(text).toContain('Depends on: uikit, components');
    expect(text).toContain('Used by: blog-constructor');
  });
});

describe('formatOverview', () => {
  it('formats overview with all fields', () => {
    const overview = {
      system: { description: 'Gravity UI', theming: 'dark/light', spacing: '4px grid', typography: 'type scales', corner_radius: '4px', branding: 'Gravity' },
      libraries: [
        { id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core', component_count: 50, depends_on: [], is_peer_dependency_of: [] },
        { id: 'components', package: '@gravity-ui/components', purpose: 'Extra', component_count: 20, depends_on: [], is_peer_dependency_of: [] },
      ],
    };
    const text = formatOverview(overview);
    expect(text).toContain('Gravity UI Design System');
    expect(text).toContain('Theming: dark/light');
    expect(text).toContain('Spacing: 4px grid');
    expect(text).toContain('Typography: type scales');
    expect(text).toContain('2 libraries: uikit, components');
  });

  it('formats overview with single library', () => {
    const overview = {
      system: { description: 'Gravity UI', theming: 'light', spacing: '8px', typography: 'mono', corner_radius: '2px', branding: 'G' },
      libraries: [
        { id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core', component_count: 50, depends_on: [], is_peer_dependency_of: [] },
      ],
    };
    const text = formatOverview(overview);
    expect(text).toContain('1 libraries: uikit');
  });
});
