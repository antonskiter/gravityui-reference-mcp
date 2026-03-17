import { describe, it, expect } from 'vitest';
import { handleFind, formatFind } from '../find.js';
import type { FindOutput } from '../find.js';
import MiniSearch from 'minisearch';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRecipe(overrides: Partial<any> & { id: string }) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    description: overrides.description ?? 'A test recipe',
    level: overrides.level ?? 'molecule',
    use_cases: overrides.use_cases ?? ['test use case'],
    packages: overrides.packages ?? [],
    tags: overrides.tags ?? ['test'],
    sections: overrides.sections ?? [],
  };
}

function makeComponent(name: string, library: string, description = '') {
  return {
    name, library,
    import_path: `@gravity-ui/${library}`,
    import_statement: `import {${name}} from '@gravity-ui/${library}';`,
    props: [], examples: [], description, source_file: '',
  };
}

function makeChunk(id: string, pageId: string, overrides: Partial<any> = {}) {
  return {
    id, page_id: pageId, url: '', page_title: overrides.page_title ?? 'Test',
    page_type: overrides.page_type ?? 'component', section_title: overrides.section_title ?? 'Section',
    breadcrumbs: [], content: overrides.content ?? 'test content',
    code_examples: [], keywords: overrides.keywords ?? ['test'],
    library: overrides.library,
  };
}

function buildIndex(chunks: any[]) {
  const ms = new MiniSearch({
    fields: ['page_title', 'section_title', 'keywords_joined', 'content'],
    storeFields: ['id'],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
  ms.addAll(chunks.map(c => ({
    id: c.id, page_title: c.page_title, section_title: c.section_title,
    keywords_joined: (c.keywords ?? []).join(' '), content: c.content,
  })));
  return ms;
}

function buildTestData(options: { recipes?: any[], components?: any[], chunks?: any[] } = {}) {
  const recipes = options.recipes ?? [];
  const components = options.components ?? [];
  const chunks = options.chunks ?? [];

  const componentByName = new Map<string, any[]>();
  for (const c of components) {
    const list = componentByName.get(c.name) || [];
    list.push(c);
    componentByName.set(c.name, list);
  }

  const pageById = new Map<string, any>();
  const tagsByPageId = new Map<string, string[]>();
  for (const c of components) {
    const pageId = `component:${c.library}:${c.name}`;
    pageById.set(pageId, { id: pageId, title: c.name, library: c.library, description: c.description });
    tagsByPageId.set(pageId, [c.name.toLowerCase()]);
  }

  return {
    recipes,
    recipeById: new Map(recipes.map((r: any) => [r.id, r])),
    componentDefs: components,
    componentByName,
    componentsByLibrary: new Map<string, any[]>(),
    pageById,
    tagsByPageId,
    chunkById: new Map(chunks.map((c: any) => [c.id, c])),
    chunksByPageId: new Map<string, any[]>(),
    index: buildIndex(chunks),
    tokens: { spacing: {}, breakpoints: {}, sizes: {} },
    categoryMap: { categories: {}, components: {} },
    pages: [],
    chunks,
    metadata: { indexed_at: '', source_commits: {} },
    overview: { system: { description: '', theming: '', spacing: '', typography: '', corner_radius: '', branding: '' }, libraries: [] },
  } as any;
}

// ---------------------------------------------------------------------------
// handleFind
// ---------------------------------------------------------------------------

describe('handleFind', () => {
  it('returns empty results for empty query tokens', () => {
    const data = buildTestData();
    const result = handleFind(data, { query: 'the a an' });
    expect(result.recipes).toHaveLength(0);
    expect(result.components).toHaveLength(0);
    expect(result.docs).toHaveLength(0);
  });

  it('matches recipes by use_cases and tags', () => {
    const data = buildTestData({
      recipes: [
        makeRecipe({
          id: 'confirmation-dialog',
          title: 'Confirmation Dialog',
          use_cases: ['confirm destructive action', 'ask user before delete'],
          tags: ['confirm', 'dialog', 'modal', 'delete'],
          sections: [{ type: 'components', items: [{ name: 'Dialog', library: 'uikit', usage: 'required', role: 'overlay' }] }],
        }),
        makeRecipe({
          id: 'data-table',
          title: 'Data Table',
          use_cases: ['display tabular data'],
          tags: ['table', 'data', 'grid'],
        }),
      ],
    });
    const result = handleFind(data, { query: 'confirm delete action' });
    expect(result.recipes.length).toBeGreaterThanOrEqual(1);
    expect(result.recipes[0].id).toBe('confirmation-dialog');
  });

  it('caps recipes at 2', () => {
    const data = buildTestData({
      recipes: Array.from({ length: 5 }, (_, i) => makeRecipe({
        id: `recipe-${i}`,
        use_cases: ['file upload pattern'],
        tags: ['file', 'upload'],
      })),
    });
    const result = handleFind(data, { query: 'file upload' });
    expect(result.recipes.length).toBeLessThanOrEqual(2);
  });

  it('caps components at 3', () => {
    const components = Array.from({ length: 10 }, (_, i) => makeComponent(`Button${i}`, 'uikit', 'clickable button'));
    const data = buildTestData({ components });
    const result = handleFind(data, { query: 'button click' });
    expect(result.components.length).toBeLessThanOrEqual(3);
  });

  it('caps docs at 2', () => {
    const chunks = Array.from({ length: 5 }, (_, i) => makeChunk(
      `chunk-${i}`, `page-${i}`,
      { page_title: `Guide ${i}`, content: 'theming dark mode setup', page_type: 'guide' },
    ));
    const data = buildTestData({ chunks });
    const result = handleFind(data, { query: 'theming dark mode' });
    expect(result.docs.length).toBeLessThanOrEqual(2);
  });

  it('extracts componentNames from recipe sections', () => {
    const data = buildTestData({
      recipes: [makeRecipe({
        id: 'test-recipe',
        use_cases: ['modal confirmation'],
        tags: ['modal'],
        sections: [
          { type: 'components', items: [
            { name: 'Dialog', library: 'uikit', usage: 'required', role: 'overlay' },
            { name: 'Button', library: 'uikit', usage: 'required', role: 'action trigger' },
          ]},
        ],
      })],
    });
    const result = handleFind(data, { query: 'modal confirmation' });
    expect(result.recipes[0].componentNames).toEqual(['Dialog', 'Button']);
  });

  it('truncates doc snippets to 100 chars', () => {
    const longContent = 'x'.repeat(300);
    const chunks = [makeChunk('c1', 'p1', { content: longContent, page_title: 'Guide', page_type: 'guide' })];
    const data = buildTestData({ chunks });
    const result = handleFind(data, { query: 'Guide' });
    if (result.docs.length > 0) {
      expect(result.docs[0].snippet.length).toBeLessThanOrEqual(100);
    }
  });

  it('returns recipe score as rounded fraction', () => {
    const data = buildTestData({
      recipes: [makeRecipe({
        id: 'test',
        use_cases: ['file upload'],
        tags: ['file', 'upload'],
      })],
    });
    const result = handleFind(data, { query: 'file upload' });
    expect(result.recipes.length).toBe(1);
    expect(result.recipes[0].score).toBeGreaterThan(0);
    // Score should be rounded to 2 decimal places
    const scoreStr = result.recipes[0].score.toString();
    const decimals = scoreStr.includes('.') ? scoreStr.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// formatFind
// ---------------------------------------------------------------------------

describe('formatFind', () => {
  it('formats empty results', () => {
    const output: FindOutput = { recipes: [], components: [], docs: [] };
    const text = formatFind(output);
    expect(text).toBe('0 results');
  });

  it('formats recipe cards with description and components', () => {
    const output: FindOutput = {
      recipes: [{
        id: 'confirmation-dialog',
        level: 'molecule',
        description: 'A pattern for confirming user actions',
        componentNames: ['Dialog', 'Button'],
        score: 0.75,
      }],
      components: [],
      docs: [],
    };
    const text = formatFind(output);
    expect(text).toContain('1 results');
    expect(text).toContain('[recipe] confirmation-dialog (molecule)');
    expect(text).toContain('A pattern for confirming user actions');
    expect(text).toContain('Components: Dialog, Button');
  });

  it('formats component cards with score', () => {
    const output: FindOutput = {
      recipes: [],
      components: [{
        name: 'Button',
        library: 'uikit',
        description: 'A clickable button',
        score: 0.85,
      }],
      docs: [],
    };
    const text = formatFind(output);
    expect(text).toContain('[component] Button (uikit) 85');
    expect(text).toContain('A clickable button');
  });

  it('formats doc cards with section', () => {
    const output: FindOutput = {
      recipes: [],
      components: [],
      docs: [{
        pageTitle: 'Theming Guide',
        sectionTitle: 'Dark Mode',
        snippet: 'How to set up dark mode in your app',
      }],
    };
    const text = formatFind(output);
    expect(text).toContain('[doc] Theming Guide — Dark Mode');
    expect(text).toContain('How to set up dark mode in your app');
  });

  it('formats mixed results correctly', () => {
    const output: FindOutput = {
      recipes: [{
        id: 'r1',
        level: 'foundation',
        description: 'Recipe desc',
        componentNames: [],
        score: 0.5,
      }],
      components: [{
        name: 'Comp',
        library: 'uikit',
        description: 'Comp desc',
        score: 0.3,
      }],
      docs: [{
        pageTitle: 'Doc',
        sectionTitle: 'Sec',
        snippet: 'Snippet text',
      }],
    };
    const text = formatFind(output);
    expect(text).toContain('3 results');
    expect(text).toContain('[recipe]');
    expect(text).toContain('[component]');
    expect(text).toContain('[doc]');
  });

  it('omits Components line when recipe has no components', () => {
    const output: FindOutput = {
      recipes: [{
        id: 'simple',
        level: 'foundation',
        description: 'A simple recipe',
        componentNames: [],
        score: 0.5,
      }],
      components: [],
      docs: [],
    };
    const text = formatFind(output);
    expect(text).not.toContain('Components:');
  });
});
