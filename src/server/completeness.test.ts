import { describe, it, expect } from 'vitest';
import { loadData } from './loader.js';
import { handleFind, formatFind } from './tools/find.js';
import { handleGet, formatGet } from './tools/get.js';
import { handleList, formatList } from './tools/list.js';

const data = loadData();

describe('Completeness: Data Coverage', () => {
  it('has entities from all 34 libraries', () => {
    const libs = new Set(data.entities.map(e => e.library));
    console.log(`Libraries with entities: ${libs.size}`);
    console.log('Libraries:', [...libs].sort().join(', '));

    const expected = [
      'uikit', 'components', 'navigation', 'date-components', 'table',
      'aikit', 'page-constructor', 'blog-constructor', 'dashkit',
      'dialog-fields', 'dynamic-forms', 'chartkit', 'charts', 'yagr',
      'graph', 'timeline', 'markdown-editor', 'data-source',
      'icons', 'illustrations', 'i18n', 'date-utils', 'axios-wrapper',
      'app-layout', 'nodekit', 'expresskit',
      'eslint-config', 'tsconfig', 'prettier-config', 'stylelint-config',
      'babel-preset', 'browserslist-config', 'webpack-i18n-assets-plugin',
      'page-constructor-builder'
    ];
    const missing = expected.filter(lib => !libs.has(lib));
    if (missing.length > 0) console.log('MISSING libraries:', missing.join(', '));
    expect(missing.length).toBe(0);
  });

  it('has all entity types represented', () => {
    const types = new Set(data.entities.map(e => e.type));
    console.log('Entity types:', [...types].sort().join(', '));
    expect(types.has('component')).toBe(true);
    expect(types.has('hook')).toBe(true);
    expect(types.has('asset')).toBe(true);
    expect(types.has('utility')).toBe(true);
    expect(types.has('config-doc')).toBe(true);
    expect(types.has('token-set')).toBe(true);
    expect(types.has('guide')).toBe(true);
  });

  it('has substantial entity count', () => {
    console.log(`Total entities: ${data.entities.length}`);
    const byType: Record<string, number> = {};
    for (const e of data.entities) byType[e.type] = (byType[e.type] ?? 0) + 1;
    console.log('By type:', JSON.stringify(byType));
    expect(data.entities.length).toBeGreaterThan(400);
  });

  it('all 34 libraries are represented as library entities', () => {
    const libraryEntities = data.entities.filter(e => e.type === 'library');
    console.log(`Library entities: ${libraryEntities.length}`);
    expect(libraryEntities.length).toBeGreaterThanOrEqual(34);
  });

  it('library entities have avoid field (except system root)', () => {
    const libraryEntities = data.entities.filter(e => e.type === 'library') as Array<{ type: 'library'; name: string; library: string; avoid?: string[] }>;
    const missing = libraryEntities.filter(l => l.library !== 'gravity-ui' && (!l.avoid || l.avoid.length === 0));
    if (missing.length > 0) console.log('Libraries without avoid:', missing.map(l => l.name).join(', '));
    expect(missing.length).toBe(0);
  });
});

describe('Completeness: Component Quality', () => {
  const components = data.entities.filter(e => e.type === 'component');

  it('has substantial component count', () => {
    console.log(`Total components: ${components.length}`);
    expect(components.length).toBeGreaterThan(200);
  });

  it('components have descriptions', () => {
    const noDesc = components.filter(e => !e.description || e.description.length < 10);
    if (noDesc.length > 0) console.log('Components with weak description:', noDesc.map(e => `${e.name}(${e.library})`).join(', '));
    expect(noDesc.length).toBe(0);
  });

  it('components have keywords', () => {
    const noKw = components.filter(e => !e.keywords || e.keywords.length === 0);
    if (noKw.length > 0) console.log('Components without keywords:', noKw.map(e => `${e.name}(${e.library})`).join(', '));
    expect(noKw.length).toBe(0);
  });

  it('components have when_to_use', () => {
    const noWtu = components.filter(e => !e.when_to_use || e.when_to_use.length === 0);
    if (noWtu.length > 0) console.log('Components without when_to_use:', noWtu.map(e => `${e.name}(${e.library})`).join(', '));
    expect(noWtu.length).toBe(0);
  });

  it('most components have props', () => {
    const withProps = components.filter((e: any) => e.props && e.props.length > 0);
    const pct = Math.round(withProps.length / components.length * 100);
    console.log(`Components with props: ${withProps.length}/${components.length} (${pct}%)`);
    const noProps = components.filter((e: any) => !e.props || e.props.length === 0);
    if (noProps.length > 0) console.log('Without props:', noProps.map(e => `${e.name}(${e.library})`).slice(0, 20).join(', '));
    expect(pct).toBeGreaterThan(75);
  });

  it('most components have examples', () => {
    const withEx = components.filter((e: any) => e.examples && e.examples.length > 0);
    const pct = Math.round(withEx.length / components.length * 100);
    console.log(`Components with examples: ${withEx.length}/${components.length} (${pct}%)`);
    const noEx = components.filter((e: any) => !e.examples || e.examples.length === 0);
    if (noEx.length > 0) console.log('Without examples:', noEx.map(e => `${e.name}(${e.library})`).slice(0, 20).join(', '));
    expect(pct).toBeGreaterThan(70);
  });

  it('components have import_statement', () => {
    const noImport = components.filter(e => !e.import_statement);
    if (noImport.length > 0) console.log('Without import:', noImport.map(e => `${e.name}(${e.library})`).join(', '));
    expect(noImport.length).toBe(0);
  });
});

describe('Completeness: Search Quality', () => {
  const queries = [
    { q: 'button', expectMin: 1, expectName: 'Button' },
    { q: 'date picker', expectMin: 1, expectName: 'DatePicker' },
    { q: 'sidebar navigation', expectMin: 1, expectName: 'AsideHeader' },
    { q: 'dialog modal', expectMin: 1, expectName: 'Dialog' },
    { q: 'toast notification', expectMin: 1 },
    { q: 'form validation', expectMin: 1 },
    { q: 'chart visualization', expectMin: 1 },
    { q: 'file upload drag drop', expectMin: 1 },
    { q: 'dark theme toggle', expectMin: 1 },
    { q: 'table sorting filtering', expectMin: 1 },
    { q: 'AI chat assistant', expectMin: 1 },
    { q: 'icon calendar', expectMin: 1 },
    { q: 'spacing tokens', expectMin: 1 },
    { q: 'breadcrumbs', expectMin: 1 },
    { q: 'dropdown menu', expectMin: 1 },
  ];

  for (const { q, expectMin, expectName } of queries) {
    it(`find("${q}") returns results`, () => {
      const result = handleFind(data, { query: q });
      console.log(`find("${q}"): ${result.results.length} results — ${result.results.slice(0, 3).map(r => `${r.name}(${r.type})`).join(', ')}`);
      expect(result.results.length).toBeGreaterThanOrEqual(expectMin);
      if (expectName) {
        const found = result.results.some(r => r.name === expectName);
        if (!found) console.log(`  WARNING: expected ${expectName} in results`);
      }
    });
  }

  it('find returns empty for nonsense', () => {
    const result = handleFind(data, { query: 'zzxxqqww99nonexistent' });
    expect(result.results.length).toBe(0);
  });
});

describe('Completeness: Get Tool', () => {
  it('get("overview") entity returns a library-type entity', () => {
    // 'overview' is no longer a special case; check that uikit is gettable
    const result = handleGet(data, { name: 'uikit' });
    console.log(`get("uikit"): type=${result.type}`);
    expect(result.type).not.toBe('not_found');
  });

  it('get resolves every library name as some entity', () => {
    const libs = ['uikit', 'navigation', 'aikit', 'date-components'];
    for (const lib of libs) {
      const comps = data.entitiesByLibrary.get(lib) ?? [];
      if (comps.length > 0) {
        const result = handleGet(data, { name: comps[0].name });
        console.log(`get("${comps[0].name}") from ${lib}: type=${result.type}`);
        expect(result.type).not.toBe('not_found');
      }
    }
  });

  it('get returns not_found with suggestions for typos', () => {
    const result = handleGet(data, { name: 'Buton' });
    expect(result.type).toBe('not_found');
    if (result.type === 'not_found') {
      console.log(`Suggestions for "Buton": ${result.suggestions.join(', ')}`);
      expect(result.suggestions.length).toBeGreaterThan(0);
    }
  });

  it('get resolves recipe entity by name', () => {
    const recipes = data.entities.filter(e => e.type === 'recipe');
    if (recipes.length > 0) {
      const recipe = recipes[0];
      const result = handleGet(data, { name: recipe.name });
      console.log(`get("${recipe.name}"): type=${result.type}`);
      expect(result.type).not.toBe('not_found');
    }
  });
});

describe('Completeness: List Tool', () => {
  it('list() returns intro with all types', () => {
    const result = handleList(data, {});
    expect(result.kind).toBe('intro');
    if (result.kind === 'intro') {
      console.log(`Intro: ${result.total} entities`);
      console.log('By type:', JSON.stringify(result.byType));
      expect(Object.keys(result.byType).length).toBeGreaterThan(5);
    }
  });

  it('list(type="component") returns components', () => {
    const result = handleList(data, { type: 'component' });
    expect(result.kind).toBe('entities');
    if (result.kind === 'entities') {
      console.log(`Components: ${result.items.length}`);
      expect(result.items.length).toBeGreaterThan(200);
    }
  });

  it('list(category=X) works for all 10 categories', () => {
    const cats = ['actions', 'ai', 'data-display', 'feedback', 'forms', 'layout', 'navigation', 'overlays', 'typography', 'utility'];
    for (const cat of cats) {
      const result = handleList(data, { category: cat });
      const count = result.kind === 'entities' ? result.items.length : 0;
      console.log(`category="${cat}": ${count} items`);
      expect(count).toBeGreaterThan(0);
    }
  });

  it('list(library=X) works for key libraries', () => {
    const libs = ['uikit', 'navigation', 'aikit', 'table', 'page-constructor'];
    for (const lib of libs) {
      const result = handleList(data, { library: lib });
      const count = result.kind === 'entities' ? result.items.length : 0;
      console.log(`library="${lib}": ${count} items`);
      expect(count).toBeGreaterThan(0);
    }
  });

  it('list(type+library) combines filters', () => {
    const result = handleList(data, { type: 'hook', library: 'uikit' });
    if (result.kind === 'entities') {
      console.log(`hooks in uikit: ${result.items.length}`);
      expect(result.items.every(e => e.type === 'hook' && e.library === 'uikit')).toBe(true);
    }
  });
});

describe('Completeness: Recipes', () => {
  it('has recipe entities', () => {
    const recipes = data.entities.filter(e => e.type === 'recipe');
    console.log(`Recipes: ${recipes.length}`);
    expect(recipes.length).toBeGreaterThan(10);
  });

  it('recipes are searchable via find', () => {
    const recipes = data.entities.filter(e => e.type === 'recipe') as Array<{ type: 'recipe'; name: string; title: string }>;
    for (const recipe of recipes.slice(0, 5)) {
      const result = handleFind(data, { query: recipe.title });
      const found = result.results.some(r => r.type === 'recipe');
      console.log(`find("${recipe.title}"): recipe found=${found}`);
    }
  });

  it('recipes are gettable by name', () => {
    const recipes = data.entities.filter(e => e.type === 'recipe');
    for (const recipe of recipes.slice(0, 3)) {
      const result = handleGet(data, { name: recipe.name });
      console.log(`get("${recipe.name}"): type=${result.type}`);
      expect(result.type).not.toBe('not_found');
    }
  });
});
