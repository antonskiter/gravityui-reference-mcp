import { describe, it, expect } from 'vitest';
import { handleGet, formatGet } from '../get.js';
import type { GetOutput } from '../get.js';
import MiniSearch from 'minisearch';

// ---------------------------------------------------------------------------
// Factories (mirrors pattern from find.test.ts)
// ---------------------------------------------------------------------------

function makeComponent(name: string, library: string, description = '') {
  return {
    name, library,
    import_path: `@gravity-ui/${library}`,
    import_statement: `import {${name}} from '@gravity-ui/${library}';`,
    props: [], examples: [], description, source_file: '',
  };
}

function makeRecipe(id: string, overrides: Partial<any> = {}) {
  return {
    id,
    title: overrides.title ?? id,
    description: overrides.description ?? 'A test recipe',
    level: overrides.level ?? 'molecule',
    use_cases: overrides.use_cases ?? ['test use case'],
    packages: overrides.packages ?? [],
    tags: overrides.tags ?? ['test'],
    sections: overrides.sections ?? [],
  };
}

function buildIndex() {
  return new MiniSearch({
    fields: ['page_title', 'section_title', 'keywords_joined', 'content'],
    storeFields: ['id'],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
}

function buildTestData(options: {
  components?: any[];
  recipes?: any[];
  libraries?: any[];
  tokens?: any;
} = {}) {
  const components = options.components ?? [];
  const recipes = options.recipes ?? [];
  const libraries = options.libraries ?? [];
  const tokens = options.tokens ?? { spacing: { '1': '4px' }, breakpoints: {}, sizes: {} };

  const componentByName = new Map<string, any[]>();
  for (const c of components) {
    const list = componentByName.get(c.name) ?? [];
    list.push(c);
    componentByName.set(c.name, list);
  }

  const recipeById = new Map<string, any>(recipes.map((r: any) => [r.id, r]));

  return {
    recipes,
    recipeById,
    componentDefs: components,
    componentByName,
    componentsByLibrary: new Map<string, any[]>(),
    pageById: new Map<string, any>(),
    tagsByPageId: new Map<string, string[]>(),
    chunkById: new Map<string, any>(),
    chunksByPageId: new Map<string, any[]>(),
    index: buildIndex(),
    tokens,
    categoryMap: { categories: {}, components: {} },
    pages: [],
    chunks: [],
    metadata: { indexed_at: '', source_commits: {} },
    overview: {
      system: { description: '', theming: 'CSS variables', spacing: '4px grid', typography: 'Inter', corner_radius: '4px', branding: '' },
      libraries,
    },
    hooks: [],
    hooksByLibrary: new Map(),
    apiFunctions: [],
    apiFunctionsByLibrary: new Map(),
    assets: [],
    assetsByLibrary: new Map(),
    configDocs: [],
  } as any;
}

// ---------------------------------------------------------------------------
// handleGet
// ---------------------------------------------------------------------------

describe('handleGet', () => {
  it('returns component for known name', () => {
    const data = buildTestData({
      components: [makeComponent('Button', 'uikit', 'A clickable button')],
    });
    const result = handleGet(data, { name: 'Button' });
    expect(result.type).toBe('component');
    expect(result.data.name).toBe('Button');
  });

  it('returns component case-insensitively', () => {
    const data = buildTestData({
      components: [makeComponent('Button', 'uikit')],
    });
    const result = handleGet(data, { name: 'button' });
    expect(result.type).toBe('component');
    expect(result.data.name).toBe('Button');
  });

  it('returns recipe for known id', () => {
    const data = buildTestData({
      recipes: [makeRecipe('data-table', { title: 'Data Table' })],
    });
    const result = handleGet(data, { name: 'data-table' });
    expect(result.type).toBe('recipe');
    expect(result.data.id).toBe('data-table');
  });

  it('returns tokens for spacing topic', () => {
    const data = buildTestData({ tokens: { spacing: { '1': '4px', '2': '8px' }, breakpoints: {}, sizes: {} } });
    const result = handleGet(data, { name: 'spacing' });
    expect(result.type).toBe('tokens');
    expect(result.data).toHaveProperty('spacing');
  });

  it('returns overview for "overview"', () => {
    const data = buildTestData({
      libraries: [{ id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core', component_count: 50, depends_on: [], is_peer_dependency_of: [] }],
    });
    const result = handleGet(data, { name: 'overview' });
    expect(result.type).toBe('overview');
    expect(result.data.libraries).toHaveLength(1);
  });

  it('returns library for known library id', () => {
    const data = buildTestData({
      libraries: [{ id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core components', component_count: 50, depends_on: [], is_peer_dependency_of: [] }],
    });
    const result = handleGet(data, { name: 'uikit' });
    expect(result.type).toBe('library');
    expect(result.data.id).toBe('uikit');
  });

  it('returns not_found for unknown name', () => {
    const data = buildTestData();
    const result = handleGet(data, { name: '__totally_unknown_xyz__' });
    expect(result.type).toBe('not_found');
    expect(result.data.name).toBe('__totally_unknown_xyz__');
  });

  it('includes seeAlso when multiple libraries have the same component', () => {
    const data = buildTestData({
      components: [
        makeComponent('Button', 'uikit'),
        makeComponent('Button', 'other-lib'),
      ],
    });
    const result = handleGet(data, { name: 'Button' });
    expect(result.type).toBe('component');
    expect(result.seeAlso).toBeDefined();
    expect(result.seeAlso!.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// formatGet
// ---------------------------------------------------------------------------

describe('formatGet', () => {
  it('type=component — formats component output', () => {
    const output: GetOutput = {
      type: 'component',
      data: {
        name: 'Button',
        library: 'uikit',
        import_path: '@gravity-ui/uikit',
        import_statement: "import {Button} from '@gravity-ui/uikit';",
        props: [],
        examples: [],
        source_file: '',
      },
    };
    const result = formatGet(output);
    expect(result).toContain('Button');
    expect(result).toContain('@gravity-ui/uikit');
  });

  it('type=component — appends seeAlso disambiguation', () => {
    const output: GetOutput = {
      type: 'component',
      data: {
        name: 'Button',
        library: 'uikit',
        import_path: '@gravity-ui/uikit',
        import_statement: "import {Button} from '@gravity-ui/uikit';",
        props: [],
        examples: [],
        source_file: '',
      },
      seeAlso: ['Button (other-lib)'],
    };
    const result = formatGet(output);
    expect(result).toContain('Also available in: Button (other-lib)');
  });

  it('type=recipe — delegates to formatRecipe (compact)', () => {
    const output: GetOutput = {
      type: 'recipe',
      data: {
        id: 'form-recipe',
        title: 'Form Recipe',
        description: 'How to build forms.',
        level: 'molecule',
        use_cases: [],
        packages: ['@gravity-ui/uikit'],
        tags: [],
        sections: [],
      },
    };
    const result = formatGet(output, 'compact');
    expect(result).toContain('Form Recipe (molecule)');
    expect(result).toContain('Install: @gravity-ui/uikit');
  });

  it('type=tokens — delegates to formatGetDesignTokens', () => {
    const output: GetOutput = {
      type: 'tokens',
      data: { spacing: { '1': '4px', '2': '8px' } },
    };
    const result = formatGet(output);
    expect(result).toContain('Spacing');
    expect(result).toContain('1: 4px');
  });

  it('type=overview — delegates to formatOverview', () => {
    const output: GetOutput = {
      type: 'overview',
      data: {
        system: {
          description: '',
          theming: 'CSS variables',
          spacing: '4px grid',
          typography: 'Inter',
          corner_radius: '4px',
          branding: '',
        },
        libraries: [
          { id: 'uikit', package: '@gravity-ui/uikit', purpose: 'Core', component_count: 50, depends_on: [], is_peer_dependency_of: [] },
        ],
      },
    };
    const result = formatGet(output);
    expect(result).toContain('Gravity UI Design System');
    expect(result).toContain('Theming: CSS variables');
    expect(result).toContain('1 libraries:');
  });

  it('type=library — delegates to formatLibrary', () => {
    const output: GetOutput = {
      type: 'library',
      data: {
        id: 'icons',
        package: '@gravity-ui/icons',
        purpose: 'Icon set.',
        component_count: 500,
        depends_on: [],
        is_peer_dependency_of: ['uikit'],
      },
    };
    const result = formatGet(output);
    expect(result).toContain('icons (@gravity-ui/icons)');
    expect(result).toContain('500 components');
    expect(result).toContain('Used by: uikit');
  });

  it('type=not_found — returns not found message with name', () => {
    const output: GetOutput = {
      type: 'not_found',
      data: { name: 'NonExistentWidget', suggestions: [] },
    };
    const result = formatGet(output);
    expect(result).toContain("'NonExistentWidget' not found.");
    expect(result).toContain("Try find('NonExistentWidget')");
  });

  it('type=not_found — includes similar suggestions when present', () => {
    const output: GetOutput = {
      type: 'not_found',
      data: { name: 'Buton', suggestions: ['Button', 'ButtonGroup'] },
    };
    const result = formatGet(output);
    expect(result).toContain('Similar: Button, ButtonGroup');
  });
});
