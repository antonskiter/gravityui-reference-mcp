import { describe, it, expect } from 'vitest';
import { formatRecipe } from '../format-recipe.js';
import type { RecipeDef } from '../../../types.js';

// ---------------------------------------------------------------------------
// Minimal factory
// ---------------------------------------------------------------------------

function makeRecipe(overrides: Partial<RecipeDef> = {}): RecipeDef {
  return {
    id: 'test-recipe',
    title: 'Test Recipe',
    description: 'A description of the recipe.',
    level: 'molecule',
    use_cases: ['Testing'],
    packages: ['@gravity-ui/uikit'],
    tags: ['test'],
    sections: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// compact mode
// ---------------------------------------------------------------------------

describe('formatRecipe — compact mode', () => {
  it('includes header line with title and level', () => {
    const result = formatRecipe(makeRecipe(), 'compact');
    expect(result).toContain('Test Recipe (molecule)');
  });

  it('includes description', () => {
    const result = formatRecipe(makeRecipe(), 'compact');
    expect(result).toContain('A description of the recipe.');
  });

  it('includes decision section when present', () => {
    const recipe = makeRecipe({
      sections: [
        { type: 'decision', when: 'Use this always', not_for: 'Never use for X' },
      ],
    });
    const result = formatRecipe(recipe, 'compact');
    expect(result).toContain('When: Use this always');
    expect(result).toContain('Not for: Never use for X');
  });

  it('includes components section when present', () => {
    const recipe = makeRecipe({
      sections: [
        {
          type: 'components',
          items: [
            { name: 'Button', library: 'uikit', usage: 'required', role: 'Primary action trigger' },
          ],
        },
      ],
    });
    const result = formatRecipe(recipe, 'compact');
    expect(result).toContain('Components:');
    expect(result).toContain('Button (uikit) [required] — Primary action trigger');
  });

  it('includes install line when packages are present', () => {
    const result = formatRecipe(makeRecipe({ packages: ['@gravity-ui/uikit', '@gravity-ui/icons'] }), 'compact');
    expect(result).toContain('Install: @gravity-ui/uikit @gravity-ui/icons');
  });

  it('omits install line when packages array is empty', () => {
    const result = formatRecipe(makeRecipe({ packages: [] }), 'compact');
    expect(result).not.toContain('Install:');
  });

  it('does not include structure or examples in compact mode', () => {
    const recipe = makeRecipe({
      sections: [
        { type: 'structure', tree: ['Root', '  Child'], flow: ['Step 1'] },
        { type: 'example', title: 'Basic', code: '<Button />' },
      ],
    });
    const result = formatRecipe(recipe, 'compact');
    expect(result).not.toContain('Structure:');
    expect(result).not.toContain('Example:');
  });
});

// ---------------------------------------------------------------------------
// full mode
// ---------------------------------------------------------------------------

describe('formatRecipe — full mode', () => {
  const fullRecipe = makeRecipe({
    sections: [
      { type: 'decision', when: 'Use always', not_for: 'Not for modals', matrix: [
        { situation: 'Primary CTA', component: 'Button', why: 'Most visible' },
      ]},
      {
        type: 'components',
        items: [
          { name: 'Button', library: 'uikit', usage: 'required', role: 'Submit' },
        ],
      },
      { type: 'structure', tree: ['Form', '  Button'], flow: ['User fills form', 'User clicks submit'] },
      { type: 'example', title: 'Basic form', code: '<form><Button>Submit</Button></form>' },
      { type: 'avoid', items: ['Do not use link as submit'] },
      { type: 'related', items: [{ id: 'modal-recipe', note: 'For overlay patterns' }] },
    ],
  });

  it('includes structure tree in full mode', () => {
    const result = formatRecipe(fullRecipe, 'full');
    expect(result).toContain('Structure:');
    expect(result).toContain('Form');
    expect(result).toContain('  Button');
  });

  it('includes flow in full mode', () => {
    const result = formatRecipe(fullRecipe, 'full');
    expect(result).toContain('Flow:');
    expect(result).toContain('User fills form');
  });

  it('includes decision matrix in full mode', () => {
    const result = formatRecipe(fullRecipe, 'full');
    expect(result).toContain('Decision matrix:');
    expect(result).toContain('Primary CTA -> Button — Most visible');
  });

  it('includes example with code block in full mode', () => {
    const result = formatRecipe(fullRecipe, 'full');
    expect(result).toContain('Example: Basic form');
    expect(result).toContain('```tsx');
    expect(result).toContain('<form><Button>Submit</Button></form>');
  });

  it('includes avoid section in full mode', () => {
    const result = formatRecipe(fullRecipe, 'full');
    expect(result).toContain('Avoid:');
    expect(result).toContain('Do not use link as submit');
  });

  it('includes related section in full mode', () => {
    const result = formatRecipe(fullRecipe, 'full');
    expect(result).toContain('Related:');
    expect(result).toContain('modal-recipe — For overlay patterns');
  });

  it('still includes compact content (header, decision, components, install)', () => {
    const result = formatRecipe(fullRecipe, 'full');
    expect(result).toContain('Test Recipe (molecule)');
    expect(result).toContain('When: Use always');
    expect(result).toContain('Button (uikit) [required] — Submit');
    expect(result).toContain('Install: @gravity-ui/uikit');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('formatRecipe — edge cases', () => {
  it('handles recipe with no sections gracefully', () => {
    const recipe = makeRecipe({ sections: [] });
    const result = formatRecipe(recipe, 'full');
    expect(result).toContain('Test Recipe (molecule)');
    expect(result).toContain('A description of the recipe.');
    expect(result).not.toContain('Components:');
    expect(result).not.toContain('Structure:');
  });

  it('handles components section with empty items array', () => {
    const recipe = makeRecipe({
      sections: [{ type: 'components', items: [] }],
    });
    const result = formatRecipe(recipe, 'compact');
    expect(result).not.toContain('Components:');
  });

  it('handles avoid section with empty items array', () => {
    const recipe = makeRecipe({
      sections: [{ type: 'avoid', items: [] }],
    });
    const result = formatRecipe(recipe, 'full');
    expect(result).not.toContain('Avoid:');
  });

  it('handles related section with empty items array', () => {
    const recipe = makeRecipe({
      sections: [{ type: 'related', items: [] }],
    });
    const result = formatRecipe(recipe, 'full');
    expect(result).not.toContain('Related:');
  });

  it('handles structure section with no tree or flow', () => {
    const recipe = makeRecipe({
      sections: [{ type: 'structure' }],
    });
    const result = formatRecipe(recipe, 'full');
    expect(result).not.toContain('Structure:');
    expect(result).not.toContain('Flow:');
  });

  it('defaults to compact when detail is not specified', () => {
    const recipe = makeRecipe({
      sections: [
        { type: 'example', title: 'Test', code: '<Test />' },
      ],
    });
    const result = formatRecipe(recipe);
    expect(result).not.toContain('Example:');
  });
});
