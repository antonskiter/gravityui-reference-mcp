import { describe, it, expect } from 'vitest';
import { handleList, formatList } from '../list.js';

function makeComponent(name: string, library: string) {
  return {
    name, library, import_path: `@gravity-ui/${library}`,
    import_statement: '', props: [], examples: [], description: '', source_file: '',
  };
}

function makeRecipe(id: string, level: string) {
  return {
    id, title: id, description: `Recipe ${id}`, level,
    use_cases: [], packages: [], tags: [], sections: [],
  };
}

function buildTestData(options: { components?: any[], recipes?: any[], tokens?: any, overview?: any } = {}) {
  const components = options.components ?? [
    makeComponent('Button', 'uikit'),
    makeComponent('TextInput', 'uikit'),
  ];
  const recipes = options.recipes ?? [];
  const tokens = options.tokens ?? {
    spacing: { '1': '4px', '2': '8px' },
    breakpoints: { s: 576, m: 768 },
    sizes: { m: '28px' },
    colors: { primary: '#000', secondary: '#fff' },
    typography: { body: '14px' },
  };
  const overview = options.overview ?? {
    system: { description: 'GravityUI', theming: 'themes', spacing: '4px', typography: 'scales', corner_radius: '4px', branding: 'Gravity' },
    libraries: [
      { id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core UI components. Built on React.', component_count: 50, depends_on: [], is_peer_dependency_of: [] },
      { id: 'components', package: '@gravity-ui/components', purpose: 'Higher-level components. Extends uikit.', component_count: 20, depends_on: ['uikit'], is_peer_dependency_of: [] },
    ],
  };

  const componentsByLibrary = new Map<string, any[]>();
  for (const c of components) {
    const list = componentsByLibrary.get(c.library) || [];
    list.push(c);
    componentsByLibrary.set(c.library, list);
  }

  return {
    componentDefs: components,
    componentsByLibrary,
    componentByName: new Map<string, any[]>(),
    recipes,
    recipeById: new Map(recipes.map((r: any) => [r.id, r])),
    tokens,
    overview,
    categoryMap: {
      categories: { actions: 'Actions', forms: 'Form Controls' },
      components: { Button: 'actions', TextInput: 'forms' },
    },
    pageById: new Map(), tagsByPageId: new Map(), chunkById: new Map(),
    index: { search: () => [] } as any,
  } as any;
}

describe('handleList — table of contents (no args)', () => {
  it('returns toc with counts', () => {
    const data = buildTestData({
      recipes: [makeRecipe('r1', 'molecule'), makeRecipe('r2', 'organism')],
    });
    const result = handleList(data, {});
    expect(result.kind).toBe('toc');
    if (result.kind === 'toc') {
      expect(result.componentCount).toBe(2);
      expect(result.libraryCount).toBe(2);
      expect(result.recipeCount).toBe(2);
      expect(result.tokenTopics).toContain('spacing');
      expect(result.categories.length).toBeGreaterThan(0);
    }
  });
});

describe('handleList — components', () => {
  it('returns grouped components', () => {
    const result = handleList(buildTestData(), { what: 'components' });
    expect(result.kind).toBe('components');
  });

  it('filters by category slug', () => {
    const result = handleList(buildTestData(), { what: 'components', filter: 'actions' });
    expect(result.kind).toBe('components');
    if (result.kind === 'components') {
      expect(result.totalCount).toBe(1);
      expect(result.groups[0].components[0].name).toBe('Button');
    }
  });

  it('filters by library ID', () => {
    const data = buildTestData({
      components: [
        makeComponent('Button', 'uikit'),
        makeComponent('AsideHeader', 'navigation'),
      ],
    });
    const result = handleList(data, { what: 'components', filter: 'uikit' });
    expect(result.kind).toBe('components');
    if (result.kind === 'components') {
      expect(result.totalCount).toBe(1);
    }
  });
});

describe('handleList — recipes', () => {
  it('groups by level', () => {
    const data = buildTestData({
      recipes: [
        makeRecipe('theming', 'foundation'),
        makeRecipe('dialog', 'molecule'),
        makeRecipe('table', 'organism'),
      ],
    });
    const result = handleList(data, { what: 'recipes' });
    expect(result.kind).toBe('recipes');
    if (result.kind === 'recipes') {
      expect(result.byLevel.foundation).toHaveLength(1);
      expect(result.byLevel.molecule).toHaveLength(1);
      expect(result.byLevel.organism).toHaveLength(1);
      expect(result.totalCount).toBe(3);
    }
  });

  it('filters by level', () => {
    const data = buildTestData({
      recipes: [
        makeRecipe('theming', 'foundation'),
        makeRecipe('dialog', 'molecule'),
      ],
    });
    const result = handleList(data, { what: 'recipes', filter: 'molecule' });
    expect(result.kind).toBe('recipes');
    if (result.kind === 'recipes') {
      expect(result.totalCount).toBe(1);
      expect(result.byLevel.molecule).toHaveLength(1);
      expect(result.byLevel.foundation).toBeUndefined();
    }
  });
});

describe('handleList — libraries', () => {
  it('returns library list from overview', () => {
    const result = handleList(buildTestData(), { what: 'libraries' });
    expect(result.kind).toBe('libraries');
    if (result.kind === 'libraries') {
      expect(result.libraries).toHaveLength(2);
      expect(result.libraries[0].id).toBe('uikit');
    }
  });
});

describe('handleList — tokens', () => {
  it('returns topic list with counts', () => {
    const result = handleList(buildTestData(), { what: 'tokens' });
    expect(result.kind).toBe('tokens');
    if (result.kind === 'tokens') {
      expect(result.topics.length).toBeGreaterThanOrEqual(4);
      const spacing = result.topics.find(t => t.topic === 'spacing');
      expect(spacing).toBeDefined();
      expect(spacing!.count).toBe(2);
    }
  });
});

describe('handleList — error handling', () => {
  it('returns error for invalid what value', () => {
    const result = handleList(buildTestData(), { what: 'invalid' as any });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('invalid');
    }
  });
});

describe('formatList', () => {
  it('formats toc as compact table of contents', () => {
    const data = buildTestData({
      recipes: [makeRecipe('r1', 'molecule')],
    });
    const result = handleList(data, {});
    const output = formatList(result);
    expect(output).toContain('Components');
    expect(output).toContain('2');
    expect(output).toContain('libraries');
    expect(output).toContain('Recipes');
    expect(output).toContain('Tokens');
    expect(output).toContain('spacing');
  });

  it('formats components by delegating to formatListComponents', () => {
    const result = handleList(buildTestData(), { what: 'components' });
    const output = formatList(result);
    expect(output).toContain('Button');
    expect(output).toContain('TextInput');
  });

  it('formats recipes grouped by level', () => {
    const data = buildTestData({
      recipes: [
        makeRecipe('theming', 'foundation'),
        makeRecipe('dialog', 'molecule'),
      ],
    });
    const result = handleList(data, { what: 'recipes' });
    const output = formatList(result);
    expect(output).toContain('foundation');
    expect(output).toContain('theming');
    expect(output).toContain('molecule');
    expect(output).toContain('dialog');
  });

  it('formats libraries with id, package, count, and purpose', () => {
    const result = handleList(buildTestData(), { what: 'libraries' });
    const output = formatList(result);
    expect(output).toContain('uikit');
    expect(output).toContain('@gravity-ui/uikit');
    expect(output).toContain('50');
    expect(output).toContain('Core UI components');
  });

  it('formats tokens with topic, hint, and count', () => {
    const result = handleList(buildTestData(), { what: 'tokens' });
    const output = formatList(result);
    expect(output).toContain('spacing');
    expect(output).toContain('2');
  });

  it('formats error message', () => {
    const result = handleList(buildTestData(), { what: 'invalid' as any });
    const output = formatList(result);
    expect(output).toContain('invalid');
    expect(output).toContain('not valid');
  });
});
