// src/ingest/validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateDataDir, type ValidationResult } from './validate.js';

describe('validateDataDir', () => {
  it('validates the data directory', () => {
    const result = validateDataDir('data');
    expect(result).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(result.warnings).toBeDefined();
  });

  it('has no fatal errors on current data', () => {
    const result = validateDataDir('data');
    if (result.errors.length > 0) {
      console.log('Validation errors:', result.errors);
    }
    expect(result.errors.length).toBe(0);
  });

  it('detects _system.json presence', () => {
    const result = validateDataDir('data');
    const systemWarning = result.warnings.find(w => w.includes('_system.json'));
    expect(systemWarning).toBeUndefined();
  });

  it('detects _recipes.json presence', () => {
    const result = validateDataDir('data');
    const recipesWarning = result.warnings.find(w => w.includes('_recipes.json'));
    expect(recipesWarning).toBeUndefined();
  });
});
