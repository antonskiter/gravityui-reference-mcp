// src/server/index-builder.test.ts
import { describe, it, expect } from 'vitest';
import { buildSearchIndex, searchEntities } from './index-builder.js';
import type { Entity, RecipeDef } from '../schemas.js';

const mockEntities: Entity[] = [
  {
    type: 'component', name: 'Button', library: 'uikit',
    description: 'A versatile button for triggering actions.',
    keywords: ['button', 'action', 'click', 'submit'],
    when_to_use: ['Trigger actions', 'Submit forms'],
    avoid: [], import_statement: '', related: [],
    props: [], examples: [],
  },
  {
    type: 'component', name: 'DatePicker', library: 'date-components',
    description: 'Date selection component.',
    keywords: ['date', 'calendar', 'picker'],
    when_to_use: ['Select a date'], avoid: [],
    import_statement: '', related: [], props: [], examples: [],
  },
  {
    type: 'hook', name: 'useTheme', library: 'uikit',
    description: 'Access current theme.',
    keywords: ['theme', 'dark', 'light'],
    when_to_use: ['Read theme in components'], avoid: [],
    import_statement: '', related: [], parameters: [], examples: [],
  },
];

const mockRecipes: RecipeDef[] = [
  {
    id: 'date-form', title: 'Date Form', description: 'Form with date inputs.',
    level: 'molecule', use_cases: ['Date selection in forms'],
    packages: ['@gravity-ui/uikit'], tags: ['form', 'date'],
    sections: [],
  },
];

describe('buildSearchIndex', () => {
  it('indexes entities and recipes', () => {
    const index = buildSearchIndex(mockEntities, mockRecipes);
    expect(index).toBeDefined();
  });
});

describe('searchEntities', () => {
  it('finds components by keyword', () => {
    const index = buildSearchIndex(mockEntities, mockRecipes);
    const results = searchEntities(index, 'button');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toContain('Button');
  });

  it('finds by intent (semantic keyword)', () => {
    const index = buildSearchIndex(mockEntities, mockRecipes);
    const results = searchEntities(index, 'calendar');
    expect(results.some(r => r.id.includes('DatePicker'))).toBe(true);
  });

  it('finds recipes', () => {
    const index = buildSearchIndex(mockEntities, mockRecipes);
    const results = searchEntities(index, 'date form');
    expect(results.some(r => r.id.includes('date-form'))).toBe(true);
  });

  it('finds hooks', () => {
    const index = buildSearchIndex(mockEntities, mockRecipes);
    const results = searchEntities(index, 'theme dark');
    expect(results.some(r => r.id.includes('useTheme'))).toBe(true);
  });

  it('filters by type', () => {
    const index = buildSearchIndex(mockEntities, mockRecipes);
    const results = searchEntities(index, 'button', { type: 'hook' });
    expect(results.every(r => r.entityType === 'hook' || r.entityType === 'recipe')).toBe(true);
  });

  it('returns empty for gibberish', () => {
    const index = buildSearchIndex(mockEntities, mockRecipes);
    const results = searchEntities(index, 'zzxxqqww99');
    expect(results).toHaveLength(0);
  });
});
