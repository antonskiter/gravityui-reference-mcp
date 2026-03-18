import { describe, it, expect } from 'vitest';
import { handleList } from '../list.js';
import type { ListInput } from '../list.js';
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
