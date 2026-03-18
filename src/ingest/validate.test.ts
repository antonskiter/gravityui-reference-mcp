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
    // May have warnings, but should not have fatal errors
    if (result.errors.length > 0) {
      console.log('Validation errors:', result.errors);
    }
    expect(result.errors.length).toBe(0);
  });
});
