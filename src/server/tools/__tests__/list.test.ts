import { describe, it, expect } from 'vitest';
import { handleList, formatList } from '../list.js';
import type { ListInput, TableOfContents, EcosystemEntityListOutput, ErrorOutput } from '../list.js';
import type { LoadedData } from '../../loader.js';

const stubData = {
  componentDefs: [],
  componentsByLibrary: new Map(),
  componentByName: new Map(),
  categoryMap: { categories: {} },
  overview: { libraries: [] },
  recipes: [],
  recipeById: new Map(),
  tokens: {},
  hooks: [],
  hooksByLibrary: new Map(),
  apiFunctions: [],
  apiFunctionsByLibrary: new Map(),
  assets: [],
  assetsByLibrary: new Map(),
  configDocs: [],
} as unknown as LoadedData;

const richData = {
  componentDefs: [{ name: 'Button', library: 'uikit' }],
  componentsByLibrary: new Map([['uikit', [{ name: 'Button', library: 'uikit' }]]]),
  componentByName: new Map([['Button', [{ name: 'Button', library: 'uikit' }]]]),
  categoryMap: { categories: {} },
  overview: {
    libraries: [
      { id: 'uikit', package: '@gravity-ui/uikit', component_count: 1, purpose: 'Core UI components.' },
    ],
  },
  recipes: [
    { id: 'recipe-1', description: 'A form recipe.', level: 'molecule', title: 'Form', tags: [], sections: [], use_cases: [] },
  ],
  recipeById: new Map(),
  tokens: {
    colors: { '--g-color-base': '#fff' },
  },
  hooks: [
    { name: 'useDisclosure', library: 'uikit', import_path: '@gravity-ui/uikit', signature: 'useDisclosure()', parameters: [], return_type: 'object', rules_of_hooks: true },
  ],
  hooksByLibrary: new Map([
    ['uikit', [{ name: 'useDisclosure', library: 'uikit', import_path: '@gravity-ui/uikit', signature: 'useDisclosure()', parameters: [], return_type: 'object', rules_of_hooks: true }]],
  ]),
  apiFunctions: [
    { name: 'cn', kind: 'function', library: 'uikit', import_path: '@gravity-ui/uikit', signature: 'cn(...args)', parameters: [], return_type: 'string' },
  ],
  apiFunctionsByLibrary: new Map([
    ['uikit', [{ name: 'cn', kind: 'function', library: 'uikit', import_path: '@gravity-ui/uikit', signature: 'cn(...args)', parameters: [], return_type: 'string' }]],
  ]),
  assets: [
    { name: 'LogoGravity', library: 'icons', import_path: '@gravity-ui/icons', category: 'logo' },
  ],
  assetsByLibrary: new Map([
    ['icons', [{ name: 'LogoGravity', library: 'icons', import_path: '@gravity-ui/icons', category: 'logo' }]],
  ]),
  configDocs: [
    { library: 'eslint-config', npm_package: '@gravity-ui/eslint-config', description: 'ESLint config.', how_to_use: '', readme: '' },
  ],
} as unknown as LoadedData;

describe('list tool — ecosystem extension', () => {
  it('returns toc when called with no params', () => {
    const result = handleList(stubData, {});
    expect(result.kind).toBe('toc');
  });

  it('accepts type parameter without error', () => {
    expect(() => handleList(stubData, { type: 'hook' } as ListInput)).not.toThrow();
  });

  it('accepts library parameter without error', () => {
    expect(() => handleList(stubData, { library: 'i18n' } as ListInput)).not.toThrow();
  });
});

describe('list tool — LoadedData lookups', () => {
  it('type=hook returns hooks from LoadedData', () => {
    const result = handleList(richData, { type: 'hook' });
    expect(result.kind).toBe('ecosystem-entities');
    if (result.kind === 'ecosystem-entities') {
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('useDisclosure');
      expect(result.entities[0].library).toBe('uikit');
      expect(result.entities[0].kind).toBe('hook');
    }
  });

  it('type=hook with library filter uses hooksByLibrary', () => {
    const result = handleList(richData, { type: 'hook', library: 'uikit' });
    expect(result.kind).toBe('ecosystem-entities');
    if (result.kind === 'ecosystem-entities') {
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('useDisclosure');
    }
  });

  it('type=hook with unknown library returns empty list', () => {
    const result = handleList(richData, { type: 'hook', library: 'unknown-lib' });
    expect(result.kind).toBe('ecosystem-entities');
    if (result.kind === 'ecosystem-entities') {
      expect(result.entities).toHaveLength(0);
    }
  });

  it('type=api-function returns api functions from LoadedData', () => {
    const result = handleList(richData, { type: 'api-function' });
    expect(result.kind).toBe('ecosystem-entities');
    if (result.kind === 'ecosystem-entities') {
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('cn');
      expect(result.entities[0].kind).toBe('function');
    }
  });

  it('type=asset returns assets from LoadedData', () => {
    const result = handleList(richData, { type: 'asset' });
    expect(result.kind).toBe('ecosystem-entities');
    if (result.kind === 'ecosystem-entities') {
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('LogoGravity');
      expect(result.entities[0].kind).toBe('logo');
    }
  });

  it('type=config-package returns config docs from LoadedData', () => {
    const result = handleList(richData, { type: 'config-package' });
    expect(result.kind).toBe('ecosystem-entities');
    if (result.kind === 'ecosystem-entities') {
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('eslint-config');
      expect(result.entities[0].kind).toBe('config');
    }
  });

  it('type=library returns ecosystem libraries', () => {
    const result = handleList(richData, { type: 'library' });
    expect(result.kind).toBe('ecosystem-libraries');
  });

  it('what=recipes returns recipe list', () => {
    const result = handleList(richData, { what: 'recipes' });
    expect(result.kind).toBe('recipes');
    if (result.kind === 'recipes') {
      expect(result.totalCount).toBe(1);
      expect(result.byLevel['molecule']).toHaveLength(1);
      expect(result.byLevel['molecule'][0].id).toBe('recipe-1');
    }
  });

  it('what=libraries returns library list', () => {
    const result = handleList(richData, { what: 'libraries' });
    expect(result.kind).toBe('libraries');
    if (result.kind === 'libraries') {
      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0].id).toBe('uikit');
    }
  });
});

// ---------------------------------------------------------------------------
// formatList
// ---------------------------------------------------------------------------

describe('formatList — kind=toc', () => {
  const toc: TableOfContents = {
    kind: 'toc',
    componentCount: 120,
    libraryCount: 5,
    categories: ['layout', 'forms', 'feedback'],
    recipeCount: 8,
    tokenTopics: ['spacing', 'colors'],
  };

  it('includes component count and library count', () => {
    const result = formatList(toc);
    expect(result).toContain('Components: 120 in 5 libraries');
  });

  it('includes categories', () => {
    const result = formatList(toc);
    expect(result).toContain('layout, forms, feedback');
  });

  it('includes recipe count', () => {
    const result = formatList(toc);
    expect(result).toContain('Recipes: 8 patterns');
  });

  it('includes token topics', () => {
    const result = formatList(toc);
    expect(result).toContain('Tokens: spacing, colors');
  });
});

describe('formatList — kind=ecosystem-entities', () => {
  const entities: EcosystemEntityListOutput = {
    kind: 'ecosystem-entities',
    type: 'hook',
    library: 'uikit',
    entities: [
      { name: 'useDisclosure', library: 'uikit', kind: 'hook' },
      { name: 'useList', library: 'uikit', kind: 'hook' },
    ],
    totalCount: 2,
  };

  it('includes count and type in header', () => {
    const result = formatList(entities);
    expect(result).toContain('2 hooks in uikit');
  });

  it('lists entity names with library and kind suffix', () => {
    const result = formatList(entities);
    expect(result).toContain('useDisclosure [uikit] (hook)');
    expect(result).toContain('useList [uikit] (hook)');
  });

  it('omits kind suffix when entity has no kind', () => {
    const noKind: EcosystemEntityListOutput = {
      kind: 'ecosystem-entities',
      type: 'component',
      entities: [{ name: 'Button', library: 'uikit' }],
      totalCount: 1,
    };
    const result = formatList(noKind);
    expect(result).toContain('Button [uikit]');
    expect(result).not.toContain('Button [uikit] (');
  });

  it('omits library qualifier in header when no library filter', () => {
    const global: EcosystemEntityListOutput = {
      kind: 'ecosystem-entities',
      type: 'hook',
      entities: [],
      totalCount: 0,
    };
    const result = formatList(global);
    expect(result).toContain('0 hooks');
    expect(result).not.toContain(' in ');
  });
});

describe('formatList — kind=error', () => {
  const error: ErrorOutput = {
    kind: 'error',
    message: "'unknown' is not valid. Use: components, recipes, libraries, tokens.",
  };

  it('returns the error message directly', () => {
    const result = formatList(error);
    expect(result).toBe(error.message);
  });
});
