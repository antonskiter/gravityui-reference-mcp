import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { validateDataDir } from './validate.js';

const TMP_DIR = join('/tmp', 'gravityui-validate-test-' + process.pid);

function makePages() {
  return [
    {
      id: 'page-1',
      title: 'Button',
      page_type: 'component',
      library: 'uikit',
      url: 'https://example.com/button',
      breadcrumbs: ['Components', 'Button'],
      description: 'A button component',
      section_ids: ['section-1'],
    },
    {
      id: 'page-2',
      title: 'Getting Started',
      page_type: 'guide',
      url: 'https://example.com/guide',
      breadcrumbs: ['Guide'],
      description: 'A guide',
      section_ids: [],
    },
  ];
}

function makeChunks() {
  return [
    {
      id: 'chunk-1',
      page_id: 'page-1',
      url: 'https://example.com/button',
      page_title: 'Button',
      page_type: 'component',
      library: 'uikit',
      section_title: 'Overview',
      breadcrumbs: ['Components', 'Button'],
      content: 'Button content',
      code_examples: [],
      keywords: ['button'],
    },
  ];
}

function makeComponents() {
  return [
    {
      name: 'Button',
      library: 'uikit',
      import_path: '@gravity-ui/uikit',
      import_statement: "import {Button} from '@gravity-ui/uikit';",
      props: [
        { name: 'size', type: 'string', required: false, description: 'Size of button' },
      ],
      examples: ['<Button>Click</Button>'],
      source_file: 'src/components/Button.tsx',
    },
  ];
}

function makeTags() {
  return {
    'page-1': ['interactive', 'form'],
    'page-2': ['guide'],
  };
}

function makeTokens() {
  return {
    spacing: { s: '4px', m: '8px' },
    breakpoints: { sm: 576, md: 768 },
    sizes: { icon: '16px' },
  };
}

function makeRecipes() {
  return [
    {
      id: 'confirmation-dialog',
      title: 'Confirmation Dialog',
      description: 'A confirmation dialog pattern',
      level: 'molecule',
      use_cases: ['confirm delete'],
      packages: ['@gravity-ui/uikit'],
      tags: ['confirm', 'dialog'],
      sections: [
        {
          type: 'decision',
          when: 'User must confirm action',
          not_for: 'Multi-step wizards',
        },
        {
          type: 'components',
          items: [
            { name: 'Button', library: 'uikit', usage: 'required', role: 'trigger' },
          ],
        },
        {
          type: 'example',
          title: 'Basic',
          code: '<ConfirmDialog />',
        },
      ],
    },
  ];
}

function writeFixtures(dir: string, overrides: Record<string, unknown> = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pages.json'), JSON.stringify(overrides.pages ?? makePages()));
  writeFileSync(join(dir, 'chunks.json'), JSON.stringify(overrides.chunks ?? makeChunks()));
  writeFileSync(join(dir, 'components.json'), JSON.stringify(overrides.components ?? makeComponents()));
  writeFileSync(join(dir, 'tags.json'), JSON.stringify(overrides.tags ?? makeTags()));
  writeFileSync(join(dir, 'tokens.json'), JSON.stringify(overrides.tokens ?? makeTokens()));
  if (overrides.recipes !== undefined) {
    writeFileSync(join(dir, 'recipes.json'), JSON.stringify(overrides.recipes));
  }
}

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('validateDataDir', () => {
  it('passes with valid fixture data', () => {
    writeFixtures(TMP_DIR);
    const result = validateDataDir(TMP_DIR);
    expect(result.fatal).toBe(false);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('reports warning for orphaned chunk referencing missing page', () => {
    const chunks = [
      ...makeChunks(),
      {
        id: 'chunk-orphan',
        page_id: 'non-existent-page',
        url: 'https://example.com/missing',
        page_title: 'Missing',
        page_type: 'component',
        library: 'uikit',
        section_title: 'Section',
        breadcrumbs: [],
        content: 'orphaned chunk',
        code_examples: [],
        keywords: [],
      },
    ];
    writeFixtures(TMP_DIR, { chunks });
    const result = validateDataDir(TMP_DIR);
    expect(result.fatal).toBe(false);
    expect(result.warnings.some(w => w.includes('non-existent-page'))).toBe(true);
  });

  it('reports warning for orphaned tag key referencing missing page', () => {
    const tags = {
      ...makeTags(),
      'ghost-page-id': ['orphan-tag'],
    };
    writeFixtures(TMP_DIR, { tags });
    const result = validateDataDir(TMP_DIR);
    expect(result.fatal).toBe(false);
    expect(result.warnings.some(w => w.includes('ghost-page-id'))).toBe(true);
  });

  it('reports warning when manifest library has no components', () => {
    writeFixtures(TMP_DIR);
    const manifest = {
      entries: [
        { library: 'uikit' },
        { library: 'missing-lib' },
      ],
    };
    const result = validateDataDir(TMP_DIR, manifest);
    expect(result.fatal).toBe(false);
    expect(result.warnings.some(w => w.includes('missing-lib'))).toBe(true);
    // uikit is present, should not appear in warnings
    expect(result.warnings.some(w => w.includes('uikit') && w.includes('missing-lib'))).toBe(false);
  });

  it('reports fatal error when components schema is invalid', () => {
    writeFixtures(TMP_DIR, {
      components: [{ bad_field: true }],
    });
    const result = validateDataDir(TMP_DIR);
    expect(result.fatal).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('reports fatal error when pages schema is invalid', () => {
    writeFixtures(TMP_DIR, {
      pages: [{ id: 123, title: 'Bad' }],
    });
    const result = validateDataDir(TMP_DIR);
    expect(result.fatal).toBe(true);
  });

  it('reports warning for components with description but empty props', () => {
    const components = [
      {
        name: 'Mystery',
        library: 'uikit',
        import_path: '@gravity-ui/uikit',
        import_statement: "import {Mystery} from '@gravity-ui/uikit';",
        props: [],
        examples: [],
        description: 'A component with no props but has a description',
        source_file: 'src/components/Mystery.tsx',
      },
    ];
    writeFixtures(TMP_DIR, { components });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('Mystery'))).toBe(true);
  });
});

describe('validateDataDir — recipes', () => {
  it('passes with valid recipes', () => {
    writeFixtures(TMP_DIR, { recipes: makeRecipes() });
    const result = validateDataDir(TMP_DIR);
    expect(result.fatal).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it('reports fatal error for invalid recipe schema', () => {
    writeFixtures(TMP_DIR, {
      recipes: [{ id: 'bad', title: 'Bad', bad_field: true }],
    });
    const result = validateDataDir(TMP_DIR);
    expect(result.fatal).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('warns when recipe references non-existent component', () => {
    const recipes = [{
      ...makeRecipes()[0],
      sections: [
        { type: 'decision', when: 'w', not_for: 'n' },
        {
          type: 'components',
          items: [{ name: 'NonExistent', library: 'uikit', usage: 'required', role: 'test' }],
        },
        { type: 'example', title: 'test', code: '<X />' },
      ],
    }];
    writeFixtures(TMP_DIR, { recipes });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('NonExistent'))).toBe(true);
  });

  it('warns when recipe references non-existent library', () => {
    const recipes = [{
      ...makeRecipes()[0],
      sections: [
        { type: 'decision', when: 'w', not_for: 'n' },
        {
          type: 'components',
          items: [{ name: 'Button', library: 'no-such-lib', usage: 'required', role: 'test' }],
        },
        { type: 'example', title: 'test', code: '<X />' },
      ],
    }];
    writeFixtures(TMP_DIR, { recipes });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('no-such-lib'))).toBe(true);
  });

  it('warns when recipe has no example section', () => {
    const recipes = [{
      ...makeRecipes()[0],
      sections: [
        { type: 'decision', when: 'w', not_for: 'n' },
      ],
    }];
    writeFixtures(TMP_DIR, { recipes });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('no example'))).toBe(true);
  });

  it('warns when recipe has no decision section', () => {
    const recipes = [{
      ...makeRecipes()[0],
      sections: [
        { type: 'example', title: 'test', code: '<X />' },
      ],
    }];
    writeFixtures(TMP_DIR, { recipes });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('no decision'))).toBe(true);
  });

  it('warns when related recipe ID does not exist', () => {
    const recipes = [{
      ...makeRecipes()[0],
      sections: [
        { type: 'decision', when: 'w', not_for: 'n' },
        { type: 'example', title: 'test', code: '<X />' },
        { type: 'related', items: [{ id: 'nonexistent-recipe', note: 'test' }] },
      ],
    }];
    writeFixtures(TMP_DIR, { recipes });
    const result = validateDataDir(TMP_DIR);
    expect(result.warnings.some(w => w.includes('nonexistent-recipe'))).toBe(true);
  });
});
